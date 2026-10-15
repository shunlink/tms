import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { AUDIT_ACTIONS } from "../audit-actions";
import { nextNumber } from "../sequence";
import type { SessionUser } from "../auth";
import { completeInvoiceTask } from "./invoice-task.service";
import { rejectDirectInvoicePaymentFields } from "../invoice-payment";

const tripInclude = {
  client: {
    include: {
      commercial: true,
      addresses: { include: { address: true } },
    },
  },
  vehicle: { select: { registrationNumber: true } },
  indent: {
    include: {
      consignment: true,
      cargo: true,
      clientFreight: true,
      loading: true,
      unloading: true,
    },
  },
} satisfies Prisma.TripInclude;

type AddrLike = {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
};

function formatAddress(addr: AddrLike | null | undefined) {
  if (!addr) return null;
  return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
}

function primaryBillingAddress(
  addresses: { type: string; isPrimary: boolean; address: AddrLike }[]
) {
  return (
    addresses.find((a) => a.type === "BILLING") ??
    addresses.find((a) => a.isPrimary) ??
    addresses[0]
  )?.address;
}

function n(v: Prisma.Decimal | number | null | undefined) {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export type InvoiceLineInput = {
  tripId: string;
  amount?: number;
  gstRate?: number;
  description?: string | null;
  lrNumber?: string | null;
  routeFrom?: string | null;
  routeTo?: string | null;
  cargoSummary?: string | null;
  vehicleReg?: string | null;
  indentNumber?: string | null;
};

export type InvoiceBillingInput = {
  billingName?: string | null;
  billingGstin?: string | null;
  billingAddress?: string | null;
  billingEmail?: string | null;
  paymentTermsDays?: number | null;
};

export type CreateInvoiceInput = {
  clientId: string;
  tripIds: string[];
  gstRate: number;
  billing?: InvoiceBillingInput;
  lines?: InvoiceLineInput[];
};

/** Build editable billing snapshot from client master (does not write to Client). */
export function buildBillingSnapshot(
  client: Prisma.ClientGetPayload<{
    include: { commercial: true; addresses: { include: { address: true } } };
  }>
) {
  const billingAddr = primaryBillingAddress(client.addresses);
  return {
    billingName: client.legalName ?? client.name,
    billingGstin: client.gstin,
    billingAddress: billingAddr ? formatAddress(billingAddr) : null,
    billingEmail: client.accountsEmail ?? client.email,
    paymentTermsDays: client.commercial?.paymentTermsDays ?? 30,
  };
}

/** Build editable line snapshot from trip/indent (does not write to Trip/Indent). */
export function buildLineSnapshot(
  trip: Prisma.TripGetPayload<{ include: typeof tripInclude }>,
  gstRate: number
) {
  const indent = trip.indent;
  const origin = indent?.loading?.city ?? trip.routeFrom;
  const destination = indent?.unloading?.city ?? trip.routeTo;
  const cargo =
    trip.cargoSummary ??
    indent?.cargo?.description ??
    indent?.consignment?.cargoTypeCode ??
    null;

  const amount = n(trip.clientRate);
  const lineGstRate = indent?.clientFreight?.gstRate != null ? n(indent.clientFreight.gstRate) : gstRate;

  return {
    tripId: trip.id,
    amount,
    gstRate: lineGstRate,
    gstAmount: Math.round(amount * lineGstRate * 100) / 100,
    description: cargo,
    lrNumber: trip.lrNumber,
    routeFrom: origin,
    routeTo: destination,
    cargoSummary: cargo,
    vehicleReg: trip.vehicle.registrationNumber,
    indentNumber: indent?.indentNumber ?? null,
  };
}

/** Load trips eligible for invoicing (POD verified / CLOSED, no invoice yet). */
export async function getInvoicePrefill(tripIds: string[], gstRate = 0.18) {
  const trips = await prisma.trip.findMany({
    where: {
      id: { in: tripIds },
      status: "CLOSED",
      invoiceLines: { none: {} },
    },
    include: tripInclude,
  });

  if (trips.length === 0) return null;

  const clientId = trips[0].clientId;
  if (trips.some((t) => t.clientId !== clientId)) {
    throw new Error("All trips must belong to the same client");
  }

  const billing = buildBillingSnapshot(trips[0].client);
  const lines = trips.map((t) => buildLineSnapshot(t, gstRate));

  return { clientId, billing, lines, trips: trips.map((t) => t.id) };
}

export async function createInvoice(input: CreateInvoiceInput, actor?: SessionUser | null) {
  const trips = await prisma.trip.findMany({
    where: {
      id: { in: input.tripIds },
      status: "CLOSED",
      invoiceLines: { none: {} },
    },
    include: tripInclude,
  });

  if (trips.length === 0) throw new Error("No valid trips selected");
  if (trips.some((t) => t.clientId !== input.clientId)) {
    throw new Error("All trips must belong to the selected client");
  }

  const defaultBilling = buildBillingSnapshot(trips[0].client);
  const billing = { ...defaultBilling, ...input.billing };

  const lineMap = new Map((input.lines ?? []).map((l) => [l.tripId, l]));
  const resolvedLines = trips.map((trip) => {
    const defaults = buildLineSnapshot(trip, input.gstRate);
    const overrides: Partial<InvoiceLineInput> = lineMap.get(trip.id) ?? {};
    const amount = overrides.amount ?? defaults.amount;
    const gstRate = overrides.gstRate ?? defaults.gstRate;
    return {
      tripId: trip.id,
      amount,
      gstRate,
      gstAmount: Math.round(amount * gstRate * 100) / 100,
      description: overrides.description ?? defaults.description,
      lrNumber: overrides.lrNumber ?? defaults.lrNumber,
      routeFrom: overrides.routeFrom ?? defaults.routeFrom,
      routeTo: overrides.routeTo ?? defaults.routeTo,
      cargoSummary: overrides.cargoSummary ?? defaults.cargoSummary,
      vehicleReg: overrides.vehicleReg ?? defaults.vehicleReg,
      indentNumber: overrides.indentNumber ?? defaults.indentNumber,
    };
  });

  const subTotal = resolvedLines.reduce((s, l) => s + l.amount, 0);
  const gstAmount = resolvedLines.reduce((s, l) => s + (l.gstAmount ?? 0), 0);
  const totalAmount = Math.round((subTotal + gstAmount) * 100) / 100;
  const invoiceNumber = await nextNumber("INV");

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (billing.paymentTermsDays ?? 30));

  const now = new Date();

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.clientInvoice.create({
      data: {
        invoiceNumber,
        clientId: input.clientId,
        dueDate,
        subTotal,
        gstAmount,
        totalAmount,
        status: "DRAFT",
        createdById: actor?.id ?? null,
        billingName: billing.billingName,
        billingGstin: billing.billingGstin,
        billingAddress: billing.billingAddress,
        billingEmail: billing.billingEmail,
        paymentTermsDays: billing.paymentTermsDays,
        lines: { create: resolvedLines },
      },
      include: { lines: { include: { trip: { select: { lrNumber: true } } } } },
    });

    await tx.invoiceTask.updateMany({
      where: {
        tripId: { in: input.tripIds },
        status: { in: ["PENDING", "SLA_BREACHED"] },
      },
      data: { invoiceId: created.id },
    });

    return created;
  });

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.CREATED_INVOICE,
    entity: "ClientInvoice",
    entityId: invoice.id,
    tripId: input.tripIds[0] ?? null,
    meta: { invoiceNumber, totalAmount, tripIds: input.tripIds },
    after: { invoiceNumber, totalAmount, tripCount: input.tripIds.length, createdBy: actor?.id },
  });

  return invoice;
}

/** Mark trips invoiced and complete finance tasks after send/finalize. */
async function onInvoiceSentToClient(invoiceId: string) {
  const lines = await prisma.clientInvoiceLine.findMany({
    where: { invoiceId },
    select: { tripId: true },
  });
  const tripIds = Array.from(new Set(lines.map((l) => l.tripId)));
  if (tripIds.length === 0) return;

  await prisma.trip.updateMany({
    where: { id: { in: tripIds }, status: "CLOSED" },
    data: { status: "INVOICED" },
  });

  for (const tripId of tripIds) {
    await completeInvoiceTask(tripId, invoiceId);
  }
}

/** Finalize a draft invoice and send to client (immutable snapshot). */
export async function finalizeInvoice(invoiceId: string, actor?: SessionUser | null) {
  const existing = await prisma.clientInvoice.findFirst({
    where: { id: invoiceId },
    include: { lines: true },
  });
  if (!existing) throw new Error("Invoice not found");
  if (existing.status !== "DRAFT") throw new Error("Only draft invoices can be finalized");
  if (existing.finalizedAt) throw new Error("Invoice is already finalized");

  const now = new Date();
  const invoice = await prisma.clientInvoice.update({
    where: { id: invoiceId },
    data: { status: "UNPAID", finalizedAt: now },
    include: { lines: { include: { trip: { select: { lrNumber: true } } } } },
  });

  await onInvoiceSentToClient(invoice.id);

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.INVOICE_FINALIZED,
    entity: "ClientInvoice",
    entityId: invoice.id,
    meta: { invoiceNumber: existing.invoiceNumber, finalizedAt: now.toISOString() },
  });

  const { safePostClientInvoiceAccrualJournal } = await import("../accounting/operational-posting.service");
  await safePostClientInvoiceAccrualJournal(invoice.id, actor?.id);

  return invoice;
}

export async function updateInvoice(
  invoiceId: string,
  input: {
    status?: string;
    billing?: InvoiceBillingInput;
    lines?: { id: string; amount?: number; gstRate?: number; description?: string | null }[];
  },
  actor?: SessionUser | null
) {
  const paymentReject = rejectDirectInvoicePaymentFields(input);
  if (paymentReject) throw new Error(paymentReject);

  const existing = await prisma.clientInvoice.findFirst({
    where: { id: invoiceId },
    include: { lines: true },
  });
  if (!existing) return null;

  const data: Prisma.ClientInvoiceUpdateInput = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  if (input.billing) {
    for (const [key, val] of Object.entries(input.billing)) {
      if (val !== undefined) {
        (data as Record<string, unknown>)[key] = val;
        before[key] = (existing as Record<string, unknown>)[key];
        after[key] = val;
      }
    }
  }

  if (input.status) {
    data.status = input.status;
    before.status = existing.status;
    after.status = input.status;
    if (input.status === "SENT" && !existing.finalizedAt) {
      data.finalizedAt = new Date();
      after.finalizedAt = data.finalizedAt;
    }
  }

  const invoice = await prisma.$transaction(async (tx) => {
    if (input.lines?.length) {
      for (const line of input.lines) {
        const existingLine = existing.lines.find((l) => l.id === line.id);
        if (!existingLine) continue;
        const amount = line.amount ?? n(existingLine.amount);
        const gstRate = line.gstRate ?? n(existingLine.gstRate);
        await tx.clientInvoiceLine.update({
          where: { id: line.id },
          data: {
            amount,
            gstRate,
            gstAmount: Math.round(amount * gstRate * 100) / 100,
            ...(line.description !== undefined ? { description: line.description } : {}),
          },
        });
      }

      const allLines = await tx.clientInvoiceLine.findMany({ where: { invoiceId } });
      const subTotal = allLines.reduce((s, l) => s + n(l.amount), 0);
      const gstAmount = allLines.reduce((s, l) => s + n(l.gstAmount), 0);
      data.subTotal = subTotal;
      data.gstAmount = gstAmount;
      data.totalAmount = Math.round((subTotal + gstAmount) * 100) / 100;
    }

    return tx.clientInvoice.update({
      where: { id: invoiceId },
      data,
      include: { lines: true },
    });
  });

  const isFinalize =
    input.status === "SENT" && existing.status !== "SENT" && !existing.finalizedAt;

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.INVOICE_EDITED,
    entity: "ClientInvoice",
    entityId: invoice.id,
    meta: { invoiceNumber: existing.invoiceNumber, fields: Object.keys(after) },
    before,
    after,
  });

  if (isFinalize) {
    await onInvoiceSentToClient(invoice.id);
    await logAudit({
      user: actor,
      action: AUDIT_ACTIONS.INVOICE_FINALIZED,
      entity: "ClientInvoice",
      entityId: invoice.id,
      meta: { invoiceNumber: existing.invoiceNumber },
    });
    const { safePostClientInvoiceAccrualJournal } = await import("../accounting/operational-posting.service");
    await safePostClientInvoiceAccrualJournal(invoice.id, actor?.id);
  }

  return invoice;
}
