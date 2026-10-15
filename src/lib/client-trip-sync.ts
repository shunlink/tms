import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** Invoices clients must not see: drafts are internal, cancelled ones are void. */
export const CLIENT_HIDDEN_INVOICE_STATUSES = ["DRAFT", "CANCELLED"];

/** Client-facing status: reflects invoice payment even when trip row is INVOICED/CLOSED. */
export function resolveClientTripDisplayStatus(
  tripStatus: string,
  invoiceLines: { invoice: { status: string } }[]
): string {
  const invoice = invoiceLines.find((l) => !CLIENT_HIDDEN_INVOICE_STATUSES.includes(l.invoice.status))?.invoice;
  if (!invoice) return tripStatus;
  if (invoice.status === "PAID") return "PAID";
  if (invoice.status === "PARTIALLY_PAID") return "PARTIALLY_PAID";
  if (tripStatus === "INVOICED" || (tripStatus === "CLOSED" && invoice.status !== "PAID")) {
    if (["SENT", "UNPAID", "OVERDUE"].includes(invoice.status)) return "INVOICED";
  }
  return tripStatus;
}

/** Keep trip lifecycle aligned with invoice payment (INVOICED → CLOSED when fully paid). */
export async function syncTripsForInvoiceStatus(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  invoiceStatus: string
) {
  const lines = await tx.clientInvoiceLine.findMany({
    where: { invoiceId },
    select: { tripId: true },
  });
  const tripIds = Array.from(new Set(lines.map((l) => l.tripId)));
  if (tripIds.length === 0) return;

  if (invoiceStatus === "PAID") {
    await tx.trip.updateMany({
      where: { id: { in: tripIds }, status: "INVOICED" },
      data: { status: "CLOSED" },
    });
    return;
  }

  if (!["UNPAID", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoiceStatus)) return;

  const paidOnOtherInvoice = await tx.clientInvoiceLine.findMany({
    where: {
      tripId: { in: tripIds },
      invoiceId: { not: invoiceId },
      invoice: { status: "PAID" },
    },
    select: { tripId: true },
  });
  const stillPaidTripIds = new Set(paidOnOtherInvoice.map((l) => l.tripId));
  const revertIds = tripIds.filter((id) => !stillPaidTripIds.has(id));
  if (revertIds.length === 0) return;

  await tx.trip.updateMany({
    where: { id: { in: revertIds }, status: "CLOSED" },
    data: { status: "INVOICED" },
  });
}

/** One-shot backfill for trips left INVOICED after their invoice was marked PAID. */
export async function backfillPaidInvoiceTripStatuses() {
  const stale = await prisma.clientInvoiceLine.findMany({
    where: {
      invoice: { status: "PAID" },
      trip: { status: "INVOICED" },
    },
    select: { tripId: true },
  });
  const tripIds = Array.from(new Set(stale.map((l) => l.tripId)));
  if (tripIds.length === 0) return 0;

  const result = await prisma.trip.updateMany({
    where: { id: { in: tripIds }, status: "INVOICED" },
    data: { status: "CLOSED" },
  });
  return result.count;
}
