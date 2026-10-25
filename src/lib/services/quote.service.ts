import { Prisma } from "@prisma/client";
import { resolveIndentPromisedAdvanceAmount, tripAdvanceSummarySelect } from "../advance";
import { prisma } from "../prisma";
import { isIndentOpenForVendorQuoting } from "../indent-vendor-visibility";

const n = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

export type SubmitQuoteInput = {
  quotedRate: number;
  vehicleId?: string | null;
  remarks?: string | null;
  channel: "PORTAL" | "WHATSAPP";
};

export async function listQuotesForIndent(indentId: string, limit = 50) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId }, select: { id: true } });
  if (!indent) return null;

  const quotes = await prisma.vendorQuote.findMany({
    where: { indentId, status: { in: ["ACTIVE", "ACCEPTED"] } },
    orderBy: { quotedRate: "asc" },
    take: Math.max(limit, 1),
    include: {
      vendor: { select: { id: true, name: true, phone: true, rating: true } },
      vehicle: { select: { id: true, registrationNumber: true, vehicleTypeCode: true } },
    },
  });

  return quotes.map((q) => ({
    id: q.id,
    vendorId: q.vendorId,
    vendorName: q.vendor.name,
    vendorPhone: q.vendor.phone,
    vendorRating: q.vendor.rating ? q.vendor.rating.toNumber() : null,
    vehicleId: q.vehicleId,
    vehicleNumber: q.vehicle?.registrationNumber ?? null,
    vehicleType: q.vehicle?.vehicleTypeCode ?? null,
    quotedRate: q.quotedRate.toNumber(),
    channel: q.channel,
    remarks: q.remarks,
    submittedAt: q.submittedAt.toISOString(),
  }));
}

/** Top 5 vendor matches for an indent (explicit admin allocation, never auto). */
export async function listTopQuotes(indentId: string) {
  return listQuotesForIndent(indentId, 5);
}

export async function submitVendorQuote(
  indentId: string,
  vendorId: string,
  input: SubmitQuoteInput
) {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    include: { consignment: true },
  });
  if (!indent) throw new Error("Indent not found");
  if (!isIndentOpenForVendorQuoting(indent)) {
    throw new Error("This indent is no longer open for quoting");
  }

  const existing = await prisma.vendorQuote.findUnique({
    where: { indentId_vendorId: { indentId, vendorId } },
  });
  if (existing) {
    const via = existing.channel === "WHATSAPP" ? "WhatsApp" : "the vendor portal";
    throw new Error(
      `You already submitted a quote of INR ${existing.quotedRate.toNumber()} via ${via}. Only one quote per indent is allowed.`
    );
  }

  try {
    const quote = await prisma.$transaction(async (tx) => {
      const created = await tx.vendorQuote.create({
        data: {
          indentId,
          vendorId,
          vehicleId: input.vehicleId || null,
          quotedRate: input.quotedRate,
          channel: input.channel,
          remarks: input.remarks || null,
          status: "ACTIVE",
        },
        include: { vendor: { select: { id: true, name: true } } },
      });

      if (indent.status === "RELEASED_TO_VENDORS") {
        await tx.indent.update({ where: { id: indentId }, data: { status: "QUOTING" } });
      }

      return created;
    });

    const { createImportantEvent } = await import("./important-event.service");
    await createImportantEvent({
      type: "VENDOR_QUOTE_RECEIVED",
      severity: "INFO",
      title: `Quote received from ${quote.vendor.name}`,
      indentId,
      relatedEntityId: quote.id,
    });

    if (input.channel === "PORTAL" || input.channel === "WHATSAPP") {
      const { closeQuoteSession } = await import("./whatsapp-quote-session.service");
      await closeQuoteSession(vendorId, indentId);
    }

    return {
      id: quote.id,
      quotedRate: quote.quotedRate.toNumber(),
      channel: quote.channel,
      submittedAt: quote.submittedAt,
      vendorName: quote.vendor.name,
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(
        "A quote for this indent was already recorded. Only one quote per indent is allowed — the first submission wins."
      );
    }
    throw e;
  }
}

export async function listOpenIndentsForVendor(vendorId: string) {
  const indents = await prisma.indent.findMany({
    where: {
      status: { in: ["RELEASED_TO_VENDORS", "QUOTING"] },
      vendorId: null,
      vendorReleases: { some: { vendorId } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      consignment: true,
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      payments: { where: { paymentType: "ADVANCE" }, orderBy: { paidAt: "desc" }, take: 1 },
      trips: {
        select: { advanceRequests: { select: tripAdvanceSummarySelect } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      quotes: {
        where: { vendorId, status: { in: ["ACTIVE", "ACCEPTED"] } },
        select: { id: true, quotedRate: true, channel: true, submittedAt: true, status: true },
      },
    },
  });

  return indents
    .filter((i) => isIndentOpenForVendorQuoting(i))
    .map((i) => {
      return {
        id: i.id,
        indentNumber: i.indentNumber,
        client: i.client.name,
        route: `${i.loading?.city ?? "—"} → ${i.unloading?.city ?? "—"}`,
        vehicleType: i.consignment?.vehicleTypeCode ?? "—",
        pickupAt: i.consignment?.pickupAt ?? null,
        deliveryAt: i.consignment?.deliveryAt ?? null,
        weightValue: i.consignment?.weightValue ? n(i.consignment.weightValue) : null,
        weightUnit: i.consignment?.weightUnit ?? "MT",
        cargoType: i.consignment?.cargoTypeCode ?? null,
        status: i.status,
        advanceAmount: resolveIndentPromisedAdvanceAmount(i),
        myQuote: i.quotes[0]
          ? {
              id: i.quotes[0].id,
              quotedRate: i.quotes[0].quotedRate.toNumber(),
              channel: i.quotes[0].channel,
              submittedAt: i.quotes[0].submittedAt,
            }
          : null,
      };
    });
}
