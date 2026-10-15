import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { SessionUser } from "../auth";
import { logAudit } from "../audit";
import { nextNumber } from "../sequence";
import { round2 } from "../finance-reconciliation";
import { computeVendorBalance } from "../vendor-balance";
import { invoiceOutstanding } from "../invoice-payment";
import {
  createDraftJournal,
  postJournal,
  reversePostedJournal,
  isSourcePosted,
} from "../accounting/posting.service";
import { ensureChartOfAccounts } from "../accounting/chart-of-accounts.service";
import { buildFinancialNoteJournalLines } from "../financial-notes/posting-rules";
import { computeNoteTotals, type NoteLineInput } from "../financial-notes/calculations";
import { assertNoteTransition, isNoteEditable } from "../financial-notes/lifecycle";
import {
  getFinancialNotePolicy,
  noteRequiresApproval,
} from "../financial-notes/policy";
import {
  inferVendorNoteFromTripCharge,
  validatePurposeMatchesParties,
} from "../financial-notes/purpose";
import type { BusinessPurpose, CounterpartyType, NoteType } from "../financial-notes/types";
import { snapshotFromPayableRow } from "./authoritative-vendor-payable.service";
import { syncBalancePaymentTaskFromPayable } from "./vendor-balance-payment.service";

/** Chart seeding + journal posting can exceed Prisma's default 5s interactive transaction limit. */
const FINANCIAL_NOTE_TX = { maxWait: 15_000, timeout: 45_000 } as const;

const noteInclude: Prisma.FinancialNoteInclude = {
  lines: { orderBy: { lineNumber: "asc" } },
  vendor: { select: { id: true, name: true, gstin: true } },
  client: { select: { id: true, name: true, gstin: true } },
  trip: { select: { id: true, lrNumber: true } },
  clientInvoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, paidAmount: true } },
  tripCharge: true,
  issuedJournal: { select: { id: true, journalNumber: true, status: true } },
  reversalJournal: { select: { id: true, journalNumber: true, status: true } },
  events: {
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { id: true, name: true } } },
  },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  issuedBy: { select: { id: true, name: true } },
};

function n(v: { toNumber(): number } | number): number {
  return typeof v === "number" ? v : v.toNumber();
}

async function recordNoteEvent(
  tx: Prisma.TransactionClient,
  noteId: string,
  action: string,
  opts: {
    fromStatus?: string | null;
    toStatus?: string | null;
    actorId?: string | null;
    reason?: string | null;
    meta?: Record<string, unknown>;
  }
) {
  await tx.financialNoteEvent.create({
    data: {
      noteId,
      action,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus ?? null,
      actorId: opts.actorId ?? null,
      reason: opts.reason ?? null,
      meta: (opts.meta ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

function normalizeLines(lines: NoteLineInput[]): NoteLineInput[] {
  return lines.map((l, i) => ({
    ...l,
    lineNumber: l.lineNumber ?? i + 1,
  }));
}

export type CreateNoteInput = {
  noteType: NoteType;
  counterpartyType: CounterpartyType;
  vendorId?: string | null;
  clientId?: string | null;
  indentId?: string | null;
  tripId?: string | null;
  clientInvoiceId?: string | null;
  tripChargeId?: string | null;
  businessPurpose: BusinessPurpose | string;
  payableEffect?: string;
  reason?: string | null;
  description?: string | null;
  accountingDate?: Date;
  taxJurisdiction?: string | null;
  lines: NoteLineInput[];
};

export async function listFinancialNotes(filters?: {
  status?: string;
  noteType?: string;
  counterpartyType?: string;
  vendorId?: string;
  clientId?: string;
  tripId?: string;
  q?: string;
}) {
  const where: Prisma.FinancialNoteWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.noteType) where.noteType = filters.noteType;
  if (filters?.counterpartyType) where.counterpartyType = filters.counterpartyType;
  if (filters?.vendorId) where.vendorId = filters.vendorId;
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.tripId) where.tripId = filters.tripId;
  if (filters?.q) {
    where.OR = [
      { noteNumber: { contains: filters.q, mode: "insensitive" } },
      { reason: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  return prisma.financialNote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      vendor: { select: { name: true } },
      client: { select: { name: true } },
      trip: { select: { lrNumber: true } },
    },
  });
}

export async function getFinancialNote(id: string) {
  return prisma.financialNote.findUnique({ where: { id }, include: noteInclude });
}

async function validateCounterparty(input: CreateNoteInput) {
  validatePurposeMatchesParties(input.businessPurpose, input.counterpartyType);
  if (input.counterpartyType === "VENDOR" && !input.vendorId) {
    throw new Error("vendorId is required for vendor notes");
  }
  if (input.counterpartyType === "CLIENT" && !input.clientId) {
    throw new Error("clientId is required for client notes");
  }
  if (
    input.counterpartyType === "VENDOR" &&
    ["VENDOR_FREIGHT_INCREASE", "VENDOR_FREIGHT_REDUCTION"].includes(String(input.businessPurpose)) &&
    !input.tripChargeId &&
    !input.tripId
  ) {
    throw new Error("Trip is required for vendor freight debit/credit notes");
  }
  if (
    input.counterpartyType === "CLIENT" &&
    ["CLIENT_BILLING_INCREASE", "CLIENT_BILLING_REDUCTION"].includes(String(input.businessPurpose)) &&
    !input.clientInvoiceId
  ) {
    throw new Error("Client invoice is required for client billing notes");
  }
  if (input.tripChargeId) {
    const existing = await prisma.financialNote.findFirst({
      where: { tripChargeId: input.tripChargeId, status: { notIn: ["VOIDED", "REJECTED"] } },
    });
    if (existing) throw new Error("An active note already exists for this trip charge");
  }
}

export async function createFinancialNoteDraft(input: CreateNoteInput, actor?: SessionUser | null) {
  await validateCounterparty(input);
  const lines = normalizeLines(input.lines);
  if (lines.length === 0) throw new Error("At least one line item is required");
  const totals = computeNoteTotals(lines);
  const policy = getFinancialNotePolicy();

  let payableEffect = input.payableEffect ?? "APPLY_TO_SUBLEDGER";
  if (input.tripChargeId) {
    const charge = await prisma.tripCharge.findUnique({ where: { id: input.tripChargeId } });
    if (!charge) throw new Error("Trip charge not found");
    if (input.tripId && charge.tripId !== input.tripId) {
      throw new Error("Trip charge does not belong to the specified trip");
    }
    payableEffect = "SUBLEDGER_ALREADY_REFLECTED";
  }

  const note = await prisma.$transaction(async (tx) => {
    const created = await tx.financialNote.create({
      data: {
        noteType: input.noteType,
        counterpartyType: input.counterpartyType,
        vendorId: input.vendorId ?? null,
        clientId: input.clientId ?? null,
        indentId: input.indentId ?? null,
        tripId: input.tripId ?? null,
        clientInvoiceId: input.clientInvoiceId ?? null,
        tripChargeId: input.tripChargeId ?? null,
        businessPurpose: input.businessPurpose,
        payableEffect,
        reason: input.reason ?? null,
        description: input.description ?? null,
        accountingDate: input.accountingDate ?? null,
        taxJurisdiction: input.taxJurisdiction ?? policy.defaultTaxJurisdiction,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        status: "DRAFT",
        createdById: actor?.id ?? null,
        lines: {
          create: lines.map((l) => ({
            lineNumber: l.lineNumber!,
            description: l.description ?? null,
            quantity: l.quantity ?? 1,
            unitAmount: l.unitAmount ?? l.amount,
            amount: l.amount,
            taxRate: l.taxRate ?? null,
            taxAmount: l.taxAmount ?? 0,
          })),
        },
      },
      include: noteInclude,
    });
    await recordNoteEvent(tx, created.id, "CREATED", {
      toStatus: "DRAFT",
      actorId: actor?.id,
    });
    return created;
  });

  await logAudit({
    user: actor,
    action: "FINANCIAL_NOTE_CREATED",
    entity: "FinancialNote",
    entityId: note.id,
    tripId: note.tripId ?? undefined,
    meta: { noteType: note.noteType, totalAmount: totals.totalAmount },
  });

  return note;
}

export async function createNoteFromTripCharge(
  tripChargeId: string,
  actor?: SessionUser | null,
  overrides?: { reason?: string; description?: string }
) {
  const charge = await prisma.tripCharge.findUnique({
    where: { id: tripChargeId },
    include: { trip: { select: { id: true, vendorId: true, indentId: true } } },
  });
  if (!charge) throw new Error("Trip charge not found");

  const inferred = inferVendorNoteFromTripCharge(charge.chargeType as "DETENTION" | "DEDUCTION" | "OTHER");
  return createFinancialNoteDraft(
    {
      noteType: inferred.noteType,
      counterpartyType: "VENDOR",
      vendorId: charge.trip.vendorId,
      tripId: charge.trip.id,
      indentId: charge.trip.indentId,
      tripChargeId: charge.id,
      businessPurpose: inferred.businessPurpose,
      payableEffect: inferred.payableEffect,
      reason: overrides?.reason ?? charge.description ?? `${charge.chargeType} charge`,
      description: overrides?.description ?? charge.description,
      lines: [
        {
          description: charge.description ?? charge.chargeType,
          amount: n(charge.amount),
        },
      ],
    },
    actor
  );
}

export async function updateFinancialNoteDraft(
  id: string,
  input: Partial<CreateNoteInput>,
  actor?: SessionUser | null
) {
  const existing = await prisma.financialNote.findUnique({ where: { id } });
  if (!existing) throw new Error("Note not found");
  if (!isNoteEditable(existing.status)) {
    throw new Error("Only draft or pending-approval notes can be edited");
  }

  const lines = input.lines ? normalizeLines(input.lines) : null;
  const totals = lines ? computeNoteTotals(lines) : null;

  const note = await prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.financialNoteLine.deleteMany({ where: { noteId: id } });
      await tx.financialNoteLine.createMany({
        data: lines.map((l) => ({
          noteId: id,
          lineNumber: l.lineNumber!,
          description: l.description ?? null,
          quantity: l.quantity ?? 1,
          unitAmount: l.unitAmount ?? l.amount,
          amount: l.amount,
          taxRate: l.taxRate ?? null,
          taxAmount: l.taxAmount ?? 0,
        })),
      });
    }
    return tx.financialNote.update({
      where: { id },
      data: {
        reason: input.reason ?? undefined,
        description: input.description ?? undefined,
        businessPurpose: input.businessPurpose ?? undefined,
        accountingDate: input.accountingDate ?? undefined,
        taxableAmount: totals?.taxableAmount,
        taxAmount: totals?.taxAmount,
        totalAmount: totals?.totalAmount,
      },
      include: noteInclude,
    });
  });

  await logAudit({
    user: actor,
    action: "FINANCIAL_NOTE_UPDATED",
    entity: "FinancialNote",
    entityId: id,
  });

  return note;
}

export async function submitFinancialNoteForApproval(id: string, actor?: SessionUser | null) {
  const note = await prisma.financialNote.findUnique({ where: { id } });
  if (!note) throw new Error("Note not found");
  assertNoteTransition(note.status, "PENDING_APPROVAL");

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.financialNote.update({
      where: { id },
      data: { status: "PENDING_APPROVAL" },
      include: noteInclude,
    });
    await recordNoteEvent(tx, id, "SUBMITTED_FOR_APPROVAL", {
      fromStatus: note.status,
      toStatus: "PENDING_APPROVAL",
      actorId: actor?.id,
    });
    return row;
  });
  return updated;
}

export async function approveFinancialNote(id: string, actor?: SessionUser | null) {
  const note = await prisma.financialNote.findUnique({ where: { id } });
  if (!note) throw new Error("Note not found");
  const policy = getFinancialNotePolicy();
  if (policy.prohibitSelfApproval && note.createdById && actor?.id === note.createdById) {
    throw new Error("You cannot approve a note you created");
  }
  assertNoteTransition(note.status, "APPROVED");

  return prisma.$transaction(async (tx) => {
    const row = await tx.financialNote.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: actor?.id ?? null,
      },
      include: noteInclude,
    });
    await recordNoteEvent(tx, id, "APPROVED", {
      fromStatus: note.status,
      toStatus: "APPROVED",
      actorId: actor?.id,
    });
    return row;
  });
}

export async function rejectFinancialNote(id: string, reason: string, actor?: SessionUser | null) {
  const note = await prisma.financialNote.findUnique({ where: { id } });
  if (!note) throw new Error("Note not found");
  assertNoteTransition(note.status, "REJECTED");

  return prisma.$transaction(async (tx) => {
    const row = await tx.financialNote.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectedById: actor?.id ?? null,
        rejectionReason: reason,
      },
      include: noteInclude,
    });
    await recordNoteEvent(tx, id, "REJECTED", {
      fromStatus: note.status,
      toStatus: "REJECTED",
      actorId: actor?.id,
      reason,
    });
    return row;
  });
}

async function applyVendorSubledgerDelta(
  tx: Prisma.TransactionClient,
  note: {
    id: string;
    tripId: string | null;
    businessPurpose: string;
    totalAmount: Prisma.Decimal;
    createdById: string | null;
  }
) {
  if (!note.tripId) throw new Error("Vendor subledger adjustment requires tripId");
  const amount = n(note.totalAmount);
  const payable = await tx.vendorTripPayable.findUnique({ where: { tripId: note.tripId } });
  if (!payable) throw new Error("Vendor trip payable not found — sync payable before issuing note");

  const previous = snapshotFromPayableRow(payable);
  let additional = n(payable.additionalChargesAmount);
  let deductions = n(payable.deductionsAmount);

  if (note.businessPurpose === "VENDOR_FREIGHT_INCREASE") additional = round2(additional + amount);
  else if (note.businessPurpose === "VENDOR_FREIGHT_REDUCTION") deductions = round2(deductions + amount);
  else throw new Error("Vendor subledger apply not supported for this business purpose");

  const freight = n(payable.freightAmount);
  const tds = n(payable.tdsAmount);
  const advance = n(payable.advanceAppliedAmount);
  const balancePaid = n(payable.balancePaidAmount);
  const computed = computeVendorBalance({
    vendorRate: freight,
    advanceAmount: advance,
    additionalCharges: additional,
    deductions,
    tdsAmount: tds,
  });
  const balanceAmount = computed.balanceAmount;
  const newSnap = {
    freightAmount: freight,
    additionalChargesAmount: additional,
    deductionsAmount: deductions,
    tdsAmount: tds,
    finalPayableAmount: computed.finalPayableAmount,
    advanceAppliedAmount: advance,
    balanceAmount,
    balancePaidAmount: balancePaid,
  };

  await tx.vendorTripPayableAdjustment.create({
    data: {
      payableId: payable.id,
      adjustmentType: "FINANCIAL_NOTE",
      status: "APPLIED",
      previousAmounts: previous,
      newAmounts: newSnap,
      reason: `Financial note ${note.id}`,
      financialNoteId: note.id,
      createdById: note.createdById,
    },
  });

  await tx.vendorTripPayable.update({
    where: { id: payable.id },
    data: {
      additionalChargesAmount: additional,
      deductionsAmount: deductions,
      finalPayableAmount: computed.finalPayableAmount,
      balanceAmount,
    },
  });

  await tx.financialNote.update({
    where: { id: note.id },
    data: { subledgerAppliedAt: new Date() },
  });
}

async function applyClientInvoiceDelta(
  tx: Prisma.TransactionClient,
  note: {
    id: string;
    clientInvoiceId: string | null;
    businessPurpose: string;
    taxableAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
  }
) {
  if (!note.clientInvoiceId) throw new Error("Client note requires clientInvoiceId");
  const invoice = await tx.clientInvoice.findUnique({ where: { id: note.clientInvoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "CANCELLED") throw new Error("Cannot adjust a cancelled invoice");

  const delta = n(note.totalAmount);
  const paid = n(invoice.paidAmount);
  const currentTotal = n(invoice.totalAmount);

  if (note.businessPurpose === "CLIENT_BILLING_REDUCTION") {
    const newTotal = round2(currentTotal - delta);
    const outstanding = invoiceOutstanding(newTotal, paid);
    if (outstanding < -0.01) {
      throw new Error(
        "Reduction exceeds outstanding receivable — use refund or credit-balance workflow for fully paid invoices"
      );
    }
    await tx.clientInvoice.update({
      where: { id: invoice.id },
      data: {
        subTotal: round2(n(invoice.subTotal) - n(note.taxableAmount)),
        gstAmount: round2(n(invoice.gstAmount) - n(note.taxAmount)),
        totalAmount: newTotal,
        status: paid > 0 && outstanding > 0 ? "PARTIALLY_PAID" : invoice.status,
      },
    });
  } else if (note.businessPurpose === "CLIENT_BILLING_INCREASE") {
    await tx.clientInvoice.update({
      where: { id: invoice.id },
      data: {
        subTotal: round2(n(invoice.subTotal) + n(note.taxableAmount)),
        gstAmount: round2(n(invoice.gstAmount) + n(note.taxAmount)),
        totalAmount: round2(currentTotal + delta),
        status: paid > 0 ? "PARTIALLY_PAID" : invoice.status,
      },
    });
  } else {
    throw new Error("Client subledger apply not supported for this business purpose");
  }

  await tx.financialNote.update({
    where: { id: note.id },
    data: { subledgerAppliedAt: new Date() },
  });
}

export async function issueFinancialNote(id: string, actor?: SessionUser | null) {
  const note = await prisma.financialNote.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!note) throw new Error("Note not found");

  const policy = getFinancialNotePolicy();
  if (policy.separateIssuerFromApprover && note.approvedById && actor?.id === note.approvedById) {
    throw new Error("Issuer must be different from approver");
  }
  if (note.status === "PENDING_APPROVAL") {
    throw new Error("Note must be approved before issuance");
  }
  if (note.status === "DRAFT") {
    if (noteRequiresApproval(n(note.totalAmount))) {
      throw new Error("Note requires approval before issuance");
    }
  } else if (note.status !== "APPROVED") {
    assertNoteTransition(note.status, "ISSUED");
  }

  const posted = await isSourcePosted("FINANCIAL_NOTE", id);
  if (posted) throw new Error("Note already has a posted journal");

  const prefix = note.noteType === "DEBIT_NOTE" ? "DBN" : "CRN";
  const noteNumber = await nextNumber(prefix);
  const accountingDate = note.accountingDate ?? new Date();

  await ensureChartOfAccounts();

  const issued = await prisma.$transaction(async (tx) => {
    const locked = await tx.financialNote.findUnique({ where: { id } });
    if (!locked || locked.status === "ISSUED") {
      throw new Error("Note already issued");
    }
    if (locked.status !== "APPROVED" && locked.status !== "DRAFT") {
      throw new Error(`Cannot issue note in status ${locked.status}`);
    }
    if (locked.status === "DRAFT" && noteRequiresApproval(n(locked.totalAmount))) {
      throw new Error("Note requires approval before issuance");
    }

    if (locked.payableEffect === "APPLY_TO_SUBLEDGER") {
      if (locked.counterpartyType === "VENDOR") {
        await applyVendorSubledgerDelta(tx, locked);
      } else if (locked.counterpartyType === "CLIENT") {
        await applyClientInvoiceDelta(tx, locked);
      }
    }

    const journalLines = buildFinancialNoteJournalLines({
      noteId: id,
      noteNumber,
      businessPurpose: locked.businessPurpose,
      counterpartyType: locked.counterpartyType as CounterpartyType,
      vendorId: locked.vendorId,
      clientId: locked.clientId,
      indentId: locked.indentId,
      tripId: locked.tripId,
      taxableAmountInr: n(locked.taxableAmount),
      taxAmountInr: n(locked.taxAmount),
      totalAmountInr: n(locked.totalAmount),
      currency: locked.currency,
      includeSubledgerAmount: locked.payableEffect === "APPLY_TO_SUBLEDGER",
    });

    const idempotencyKey = `financial_note:${id}`;
    const draft = await createDraftJournal(
      {
        accountingDate,
        description: `${noteNumber} — ${locked.reason ?? locked.businessPurpose}`,
        sourceType: "FINANCIAL_NOTE",
        sourceId: id,
        idempotencyKey,
        currency: locked.currency,
        lines: journalLines,
        createdById: actor?.id,
        approvedById: locked.approvedById ?? undefined,
      },
      { tx }
    );

    const postedJournal = await postJournal(draft!.id, actor?.id, tx);

    const issued = await tx.financialNote.update({
      where: { id },
      data: {
        status: "ISSUED",
        noteNumber,
        issueDate: new Date(),
        accountingDate,
        issuedAt: new Date(),
        issuedById: actor?.id ?? null,
        issuedJournalId: postedJournal!.id,
        approvedAt: locked.approvedAt ?? (locked.status === "DRAFT" ? new Date() : locked.approvedAt),
        approvedById:
          locked.approvedById ??
          (locked.status === "DRAFT" ? actor?.id ?? undefined : locked.approvedById ?? undefined),
      },
      include: noteInclude,
    });

    await recordNoteEvent(tx, id, "ISSUED", {
      fromStatus: locked.status,
      toStatus: "ISSUED",
      actorId: actor?.id,
      meta: { noteNumber, journalId: postedJournal!.id },
    });

    return issued;
  }, FINANCIAL_NOTE_TX);

  if (
    issued.tripId &&
    issued.payableEffect === "APPLY_TO_SUBLEDGER" &&
    issued.counterpartyType === "VENDOR"
  ) {
    const { syncVendorTripPayableFromTrip } = await import("./authoritative-vendor-payable.service");
    await syncVendorTripPayableFromTrip(issued.tripId, {
      recordAdjustment: false,
      adjustmentType: "FINANCIAL_NOTE",
      reason: `Financial note ${issued.noteNumber ?? issued.id} issued`,
    });
    await syncBalancePaymentTaskFromPayable(issued.tripId);
  }

  await logAudit({
    user: actor,
    action: "FINANCIAL_NOTE_ISSUED",
    entity: "FinancialNote",
    entityId: id,
    tripId: issued.tripId ?? undefined,
    meta: { noteNumber },
  });

  return issued;
}

export async function voidFinancialNoteDraft(id: string, reason: string, actor?: SessionUser | null) {
  const note = await prisma.financialNote.findUnique({ where: { id } });
  if (!note) throw new Error("Note not found");
  if (note.status === "ISSUED") throw new Error("Issued notes cannot be voided — use reversal");
  assertNoteTransition(note.status, "VOIDED");

  return prisma.$transaction(async (tx) => {
    const row = await tx.financialNote.update({
      where: { id },
      data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason },
      include: noteInclude,
    });
    await recordNoteEvent(tx, id, "VOIDED", {
      fromStatus: note.status,
      toStatus: "VOIDED",
      actorId: actor?.id,
      reason,
    });
    return row;
  });
}

export async function reverseIssuedFinancialNote(
  id: string,
  reason: string,
  actor?: SessionUser | null
) {
  const note = await prisma.financialNote.findUnique({ where: { id } });
  if (!note) throw new Error("Note not found");
  if (note.status !== "ISSUED") throw new Error("Only issued notes can be reversed");
  assertNoteTransition(note.status, "REVERSED");
  if (!note.issuedJournalId) throw new Error("Issued note has no journal");

  if (!actor?.id) throw new Error("Actor required for reversal");
  const reversal = await reversePostedJournal(note.issuedJournalId, actor.id, {
    reason: reason || `Reversal of ${note.noteNumber}`,
  });

  if (note.subledgerAppliedAt && note.payableEffect === "APPLY_TO_SUBLEDGER") {
    if (note.counterpartyType === "VENDOR" && note.tripId) {
      const inversePurpose =
        note.businessPurpose === "VENDOR_FREIGHT_INCREASE"
          ? "VENDOR_FREIGHT_REDUCTION"
          : note.businessPurpose === "VENDOR_FREIGHT_REDUCTION"
            ? "VENDOR_FREIGHT_INCREASE"
            : null;
      if (inversePurpose) {
        await applyVendorSubledgerDelta(prisma, {
          id: note.id,
          tripId: note.tripId,
          businessPurpose: inversePurpose,
          totalAmount: note.totalAmount,
          createdById: actor.id,
        });
        if (note.tripId) {
          const { syncVendorTripPayableFromTrip } = await import("./authoritative-vendor-payable.service");
          await syncVendorTripPayableFromTrip(note.tripId, { recordAdjustment: false });
          await syncBalancePaymentTaskFromPayable(note.tripId);
        }
      }
    }
    if (note.counterpartyType === "CLIENT" && note.clientInvoiceId) {
      const inversePurpose =
        note.businessPurpose === "CLIENT_BILLING_INCREASE"
          ? "CLIENT_BILLING_REDUCTION"
          : note.businessPurpose === "CLIENT_BILLING_REDUCTION"
            ? "CLIENT_BILLING_INCREASE"
            : null;
      if (inversePurpose) {
        await applyClientInvoiceDelta(prisma, {
          id: note.id,
          clientInvoiceId: note.clientInvoiceId,
          businessPurpose: inversePurpose,
          taxableAmount: note.taxableAmount,
          taxAmount: note.taxAmount,
          totalAmount: note.totalAmount,
        });
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.financialNote.update({
      where: { id },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversalReason: reason,
        reversalJournalId: reversal!.id,
      },
      include: noteInclude,
    });
    await recordNoteEvent(tx, id, "REVERSED", {
      fromStatus: "ISSUED",
      toStatus: "REVERSED",
      actorId: actor?.id,
      reason,
      meta: { reversalJournalId: reversal!.id },
    });
    return row;
  });
}
