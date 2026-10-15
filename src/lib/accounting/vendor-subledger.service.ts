import { prisma } from "../prisma";
import { computeOutstandingVendorPayables } from "../services/vendor-payables.service";
import { managedAdvanceSourceFilter } from "../constants";
import { sumPostedOnAccount } from "./gl-balances.service";
import { CONTROL_ACCOUNT_CODES } from "./control-accounts";

export type VendorSubledgerDocumentType =
  | "PAYABLE_COMMERCIAL_APPROVED"
  | "PAYABLE_PENDING_REVIEW"
  | "PAYABLE_ADJUSTMENT"
  | "FINANCIAL_NOTE"
  | "VENDOR_PAYMENT"
  | "OPENING_BALANCE"
  | "GL_POSTING";

export type VendorSubledgerLine = {
  id: string;
  effectiveDate: Date;
  documentType: VendorSubledgerDocumentType;
  reference: string;
  description: string;
  indentId: string | null;
  tripId: string | null;
  debitMinor: number;
  creditMinor: number;
  runningBalanceMinor: number;
  sourceType: string;
  sourceId: string;
  journalEntryId: string | null;
  journalNumber: string | null;
  postingLayer: "OPERATIONAL" | "POSTED_GL";
  paymentStatus: string | null;
};

export type VendorStatement = {
  vendorId: string;
  vendorName: string;
  currency: string;
  fromDate: Date | null;
  toDate: Date | null;
  openingBalanceMinor: number;
  closingBalanceMinor: number;
  lines: VendorSubledgerLine[];
  operationalOutstandingPayableMinor: number;
  operationalAdvanceOutstandingMinor: number;
  glPayablesBalanceMinor: number;
  glAdvancesBalanceMinor: number;
};

function rupeesToMinor(n: number): number {
  return Math.round(n * 100);
}

function inDateRange(d: Date, from?: Date | null, to?: Date | null): boolean {
  const t = d.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

function applyRunningBalance(lines: VendorSubledgerLine[], openingMinor: number): VendorSubledgerLine[] {
  let bal = openingMinor;
  return lines.map((line) => {
    bal += line.creditMinor - line.debitMinor;
    return { ...line, runningBalanceMinor: bal };
  });
}

async function openingBalanceMinorBefore(
  vendorId: string,
  beforeDate: Date | null,
  currency: string
): Promise<number> {
  if (!beforeDate) return 0;
  const lines = await collectVendorLines({ vendorId, currency });
  const prior = lines.filter((l) => l.effectiveDate < beforeDate);
  return prior.reduce((s, l) => s + l.creditMinor - l.debitMinor, 0);
}

async function collectVendorLines(input: {
  vendorId: string;
  currency?: string;
  indentId?: string;
  tripId?: string;
  documentType?: VendorSubledgerDocumentType;
  paymentStatus?: string;
  reference?: string;
}): Promise<VendorSubledgerLine[]> {
  const currency = input.currency ?? "INR";
  const vendorId = input.vendorId;
  const lines: VendorSubledgerLine[] = [];

  const payables = await prisma.vendorTripPayable.findMany({
    where: {
      vendorId,
      commercialApprovalStatus: "APPROVED",
      ...(input.tripId ? { tripId: input.tripId } : {}),
      ...(input.indentId ? { indentId: input.indentId } : {}),
    },
    include: {
      trip: { select: { lrNumber: true } },
      adjustments: {
        where: { status: "APPLIED" },
        include: { financialNote: { select: { noteNumber: true, status: true } } },
      },
    },
  });

  for (const p of payables) {
    const approvedAt = p.commercialApprovedAt ?? p.updatedAt;
    const amountMinor = rupeesToMinor(Number(p.finalPayableAmount));
    lines.push({
      id: `payable:${p.id}:approved`,
      effectiveDate: approvedAt,
      documentType: "PAYABLE_COMMERCIAL_APPROVED",
      reference: p.trip.lrNumber ?? p.tripId,
      description: `Commercial payable approved — trip ${p.trip.lrNumber ?? p.tripId}`,
      indentId: p.indentId,
      tripId: p.tripId,
      debitMinor: 0,
      creditMinor: amountMinor,
      runningBalanceMinor: 0,
      sourceType: "VendorTripPayable",
      sourceId: p.id,
      journalEntryId: null,
      journalNumber: null,
      postingLayer: "OPERATIONAL",
      paymentStatus: p.commercialApprovalStatus,
    });

    for (const adj of p.adjustments) {
      const prev = adj.previousAmounts as { finalPayableAmount?: number };
      const next = adj.newAmounts as { finalPayableAmount?: number };
      const delta = (next.finalPayableAmount ?? 0) - (prev.finalPayableAmount ?? 0);
      if (Math.abs(delta) < 0.005) continue;
      const deltaMinor = rupeesToMinor(delta);
      lines.push({
        id: `payable-adj:${adj.id}`,
        effectiveDate: adj.createdAt,
        documentType: "PAYABLE_ADJUSTMENT",
        reference: adj.financialNote?.noteNumber ?? adj.adjustmentType,
        description: adj.reason ?? `Payable adjustment (${adj.adjustmentType})`,
        indentId: p.indentId,
        tripId: p.tripId,
        debitMinor: deltaMinor < 0 ? -deltaMinor : 0,
        creditMinor: deltaMinor > 0 ? deltaMinor : 0,
        runningBalanceMinor: 0,
        sourceType: "VendorTripPayableAdjustment",
        sourceId: adj.id,
        journalEntryId: null,
        journalNumber: null,
        postingLayer: "OPERATIONAL",
        paymentStatus: adj.status,
      });
    }
  }

  const pendingPayables = await prisma.vendorTripPayable.findMany({
    where: {
      vendorId,
      commercialApprovalStatus: { in: ["PENDING_REVIEW", "DRAFT"] },
      ...(input.tripId ? { tripId: input.tripId } : {}),
      ...(input.indentId ? { indentId: input.indentId } : {}),
    },
    include: {
      trip: { select: { lrNumber: true, podVerifiedAt: true } },
      balancePaymentTask: { select: { podVerifiedAt: true, status: true } },
    },
  });

  for (const p of pendingPayables) {
    const balanceDue = Math.max(0, Number(p.balanceAmount) - Number(p.balancePaidAmount));
    if (balanceDue < 0.005) continue;
    const effectiveDate =
      p.balancePaymentTask?.podVerifiedAt ?? p.trip.podVerifiedAt ?? p.updatedAt;
    lines.push({
      id: `payable:${p.id}:pending`,
      effectiveDate,
      documentType: "PAYABLE_PENDING_REVIEW",
      reference: p.trip.lrNumber ?? p.tripId,
      description: `Vendor balance payable (awaiting finance approval) — trip ${p.trip.lrNumber ?? p.tripId}`,
      indentId: p.indentId,
      tripId: p.tripId,
      debitMinor: 0,
      creditMinor: rupeesToMinor(balanceDue),
      runningBalanceMinor: 0,
      sourceType: "VendorTripPayable",
      sourceId: p.id,
      journalEntryId: null,
      journalNumber: null,
      postingLayer: "OPERATIONAL",
      paymentStatus: p.commercialApprovalStatus,
    });
  }

  const notes = await prisma.financialNote.findMany({
    where: {
      vendorId,
      counterpartyType: "VENDOR",
      status: { in: ["ISSUED", "REVERSED"] },
      ...(input.tripId ? { tripId: input.tripId } : {}),
      ...(input.indentId ? { indentId: input.indentId } : {}),
    },
    include: { issuedJournal: { select: { id: true, journalNumber: true } } },
  });

  for (const note of notes) {
    if (note.status !== "ISSUED") continue;
    const issuedAt = note.issuedAt ?? note.issueDate ?? note.accountingDate ?? note.updatedAt;
    const totalMinor = rupeesToMinor(Number(note.totalAmount));
    const isReduction =
      note.businessPurpose.includes("REDUCTION") || note.noteType === "CREDIT_NOTE";
    lines.push({
      id: `note:${note.id}`,
      effectiveDate: issuedAt,
      documentType: "FINANCIAL_NOTE",
      reference: note.noteNumber ?? note.id,
      description: note.description ?? `${note.noteType} — ${note.businessPurpose}`,
      indentId: note.indentId,
      tripId: note.tripId,
      debitMinor: isReduction ? totalMinor : 0,
      creditMinor: isReduction ? 0 : totalMinor,
      runningBalanceMinor: 0,
      sourceType: "FinancialNote",
      sourceId: note.id,
      journalEntryId: note.issuedJournalId,
      journalNumber: note.issuedJournal?.journalNumber ?? null,
      postingLayer: note.issuedJournalId ? "POSTED_GL" : "OPERATIONAL",
      paymentStatus: note.status,
    });
  }

  const payments = await prisma.vendorPayment.findMany({
    where: {
      vendorId,
      status: "PAID",
      ...(input.tripId ? { tripId: input.tripId } : {}),
      ...(input.indentId ? { indentId: input.indentId } : {}),
    },
  });

  for (const pay of payments) {
    const paidAt = pay.paidAt ?? pay.createdAt;
    const paidMinor = rupeesToMinor(Number(pay.netPayable));
    lines.push({
      id: `vp:${pay.id}`,
      effectiveDate: paidAt,
      documentType: "VENDOR_PAYMENT",
      reference: pay.referenceNo ?? pay.sourceId ?? pay.id,
      description: `${pay.paymentType} payment${pay.paymentMode ? ` (${pay.paymentMode})` : ""}`,
      indentId: pay.indentId,
      tripId: pay.tripId,
      debitMinor: paidMinor,
      creditMinor: 0,
      runningBalanceMinor: 0,
      sourceType: "VendorPayment",
      sourceId: pay.id,
      journalEntryId: null,
      journalNumber: null,
      postingLayer: "OPERATIONAL",
      paymentStatus: pay.status,
    });
  }

  const glLines = await prisma.journalLine.findMany({
    where: {
      vendorId,
      journalEntry: { status: "POSTED" },
      account: { code: { in: [CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES, CONTROL_ACCOUNT_CODES.VENDOR_ADVANCES] } },
    },
    include: {
      journalEntry: { select: { id: true, journalNumber: true, accountingDate: true, sourceType: true, sourceId: true } },
      account: { select: { code: true } },
    },
  });

  for (const gl of glLines) {
    if (gl.journalEntry.sourceType === "FINANCIAL_NOTE" || gl.journalEntry.sourceType === "OUTBOUND_PAYMENT") {
      continue;
    }
    lines.push({
      id: `gl:${gl.id}`,
      effectiveDate: gl.journalEntry.accountingDate,
      documentType: gl.journalEntry.sourceType === "OPENING_BALANCE" ? "OPENING_BALANCE" : "GL_POSTING",
      reference: gl.journalEntry.journalNumber,
      description: gl.description ?? `GL ${gl.account.code}`,
      indentId: gl.indentId,
      tripId: gl.tripId,
      debitMinor: gl.debitMinor,
      creditMinor: gl.creditMinor,
      runningBalanceMinor: 0,
      sourceType: gl.journalEntry.sourceType,
      sourceId: gl.journalEntry.sourceId ?? gl.journalEntry.id,
      journalEntryId: gl.journalEntry.id,
      journalNumber: gl.journalEntry.journalNumber,
      postingLayer: "POSTED_GL",
      paymentStatus: null,
    });
  }

  let filtered = lines;
  if (input.documentType) filtered = filtered.filter((l) => l.documentType === input.documentType);
  if (input.paymentStatus) filtered = filtered.filter((l) => l.paymentStatus === input.paymentStatus);
  if (input.reference) {
    const q = input.reference.toLowerCase();
    filtered = filtered.filter((l) => l.reference.toLowerCase().includes(q));
  }

  filtered.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
  return filtered;
}

export async function buildVendorStatement(input: {
  vendorId: string;
  fromDate?: Date;
  toDate?: Date;
  indentId?: string;
  tripId?: string;
  documentType?: VendorSubledgerDocumentType;
  paymentStatus?: string;
  reference?: string;
  currency?: string;
}): Promise<VendorStatement | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, name: true },
  });
  if (!vendor) return null;

  const currency = input.currency ?? "INR";
  const allLines = await collectVendorLines({
    vendorId: input.vendorId,
    currency,
    indentId: input.indentId,
    tripId: input.tripId,
    documentType: input.documentType,
    paymentStatus: input.paymentStatus,
    reference: input.reference,
  });

  const opening = await openingBalanceMinorBefore(input.vendorId, input.fromDate ?? null, currency);
  const ranged = allLines.filter((l) => inDateRange(l.effectiveDate, input.fromDate, input.toDate));
  const withRunning = applyRunningBalance(ranged, opening);

  const operationalPayableMinor = rupeesToMinor(await computeOutstandingVendorPayables(input.vendorId));
  const advances = await prisma.advanceRequest.findMany({
    where: {
      vendorId: input.vendorId,
      ...managedAdvanceSourceFilter(),
      status: { in: ["APPROVED", "VENDOR_ACCEPTED", "PROCESSING"] },
    },
    select: {
      approvedAmount: true,
      negotiatedAmount: true,
      requestedAmount: true,
      paidAmount: true,
    },
  });
  const advanceOutstanding = advances.reduce((s, a) => {
    const approved = Number(a.approvedAmount ?? a.negotiatedAmount ?? a.requestedAmount ?? 0);
    const paid = Number(a.paidAmount ?? 0);
    return s + Math.max(0, approved - paid);
  }, 0);
  const operationalAdvanceMinor = rupeesToMinor(advanceOutstanding);

  const glPayables = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES, {
    asOfDate: input.toDate ?? new Date(),
    vendorId: input.vendorId,
    currency,
  });
  const glAdvances = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.VENDOR_ADVANCES, {
    asOfDate: input.toDate ?? new Date(),
    vendorId: input.vendorId,
    currency,
  });

  const closing =
    withRunning.length > 0
      ? withRunning[withRunning.length - 1].runningBalanceMinor
      : opening;

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    currency,
    fromDate: input.fromDate ?? null,
    toDate: input.toDate ?? null,
    openingBalanceMinor: opening,
    closingBalanceMinor: closing,
    lines: withRunning,
    operationalOutstandingPayableMinor: operationalPayableMinor,
    operationalAdvanceOutstandingMinor: operationalAdvanceMinor,
    glPayablesBalanceMinor: glPayables.signedMinor,
    glAdvancesBalanceMinor: glAdvances.signedMinor,
  };
}

export async function listVendorSubledgerSummaries(input?: { limit?: number; offset?: number }) {
  const limit = Math.min(input?.limit ?? 50, 200);
  const offset = input?.offset ?? 0;
  const vendors = await prisma.vendor.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: limit,
    skip: offset,
  });
  const total = await prisma.vendor.count();

  const summaries = await Promise.all(
    vendors.map(async (v) => {
      const outstanding = await computeOutstandingVendorPayables(v.id);
      const glPayables = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES, {
        asOfDate: new Date(),
        vendorId: v.id,
      });
      return {
        vendorId: v.id,
        vendorName: v.name,
        operationalOutstandingMinor: rupeesToMinor(outstanding),
        glPayablesBalanceMinor: glPayables.signedMinor,
      };
    })
  );

  return { items: summaries, total, limit, offset };
}
