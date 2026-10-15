import { resolveIndentPromisedAdvanceAmount, tripAdvanceSummarySelect } from "../advance";
import { prisma } from "../prisma";
import { isIndentOpenForVendorQuoting } from "../indent-vendor-visibility";
import { resolveWhatsAppRecipient } from "../phone";
import { deliverNow } from "../notify";
import { labelOf, resolveLookupLabels } from "../lookup";
import { buildIndentBidMessage, buildIndentBidSubject, WHATSAPP_QUOTE_BUTTON_TITLE } from "../whatsapp-message";
import { buildQuoteButtonId } from "../whatsapp-parse";
import { listVendorsInCities } from "../vendor-eligibility";
import { openQuoteSession } from "./whatsapp-quote-session.service";

const n = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : null);

export type BroadcastResult = {
  /** Vendors targeted for this broadcast batch. */
  vendorCount: number;
  /** Outbox rows written. */
  notified: number;
  sent: number;
  failed: number;
  /** Vendors skipped because they have no usable WhatsApp number. */
  skipped: number;
};

/**
 * Builds the vendor-facing bid message for an indent straight from the DB.
 * Shared by the release broadcast and the WhatsApp test/preview endpoint, so
 * what an operator previews is byte-for-byte what vendors receive.
 */
export async function buildIndentBidPayload(
  indentId: string
): Promise<{ indentNumber: string; subject: string; body: string } | null> {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    include: {
      client: { select: { name: true } },
      consignment: true,
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      cargo: { select: { description: true } },
      payments: { where: { paymentType: "ADVANCE" }, orderBy: { paidAt: "desc" }, take: 1 },
      trips: {
        select: { advanceRequests: { select: tripAdvanceSummarySelect } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!indent) return null;

  const c = indent.consignment;
  const labels = await resolveLookupLabels([
    ["VEHICLE_TYPE", c?.vehicleTypeCode],
    ["BODY_TYPE", c?.bodyTypeCode],
    ["CARGO_TYPE", c?.cargoTypeCode],
  ]);

  return {
    indentNumber: indent.indentNumber,
    subject: buildIndentBidSubject(indent.indentNumber),
    body: buildIndentBidMessage({
      indentNumber: indent.indentNumber,
      clientName: indent.client?.name ?? null,
      fromCity: indent.loading?.city ?? null,
      fromState: indent.loading?.state ?? null,
      toCity: indent.unloading?.city ?? null,
      toState: indent.unloading?.state ?? null,
      vehicleType: labelOf(labels, "VEHICLE_TYPE", c?.vehicleTypeCode),
      bodyType: labelOf(labels, "BODY_TYPE", c?.bodyTypeCode),
      quantity: c?.vehicleQuantity ?? null,
      weightValue: n(c?.weightValue),
      weightUnit: c?.weightUnit ?? null,
      cargoType: labelOf(labels, "CARGO_TYPE", c?.cargoTypeCode),
      materialDescription: indent.cargo?.description ?? null,
      pickupAt: c?.pickupAt ?? null,
      deliveryAt: c?.deliveryAt ?? null,
      advanceAmount: resolveIndentPromisedAdvanceAmount(indent),
      ewayBillRequired: c?.ewayBillRequired ?? false,
      specialInstructions: c?.specialInstructions ?? null,
    }),
  };
}

/**
 * Notify eligible active vendors when an indent is released for quoting.
 *
 * The message is sent immediately (there is no background worker), and an
 * outbox row is written for every attempt so delivery is auditable and
 * failures are visible with the provider's reason.
 */
/**
 * Notify vendors about an indent release.
 * When `vendorIds` is provided, only those vendors are messaged (used for incremental re-release).
 */
export async function broadcastIndentToVendors(
  indentId: string,
  vendorIds?: string[]
): Promise<BroadcastResult> {
  const result: BroadcastResult = { vendorCount: 0, notified: 0, sent: 0, failed: 0, skipped: 0 };

  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    select: { id: true, vendorId: true, status: true, loading: { select: { city: true } } },
  });
  if (!indent || !isIndentOpenForVendorQuoting(indent)) return result;

  const payload = await buildIndentBidPayload(indentId);
  if (!payload) return result;

  let targets: Array<{ id: string; name: string; phone: string | null; whatsapp: string | null }>;
  if (vendorIds && vendorIds.length > 0) {
    targets = await prisma.vendor.findMany({
      where: { id: { in: vendorIds }, isActive: true, deletedAt: null },
      select: { id: true, name: true, phone: true, whatsapp: true },
    });
  } else {
    const releaseCities = await prisma.indentReleaseCity.findMany({
      where: { indentId },
      select: { city: true },
    });
    targets = await listVendorsInCities(releaseCities.map((r) => r.city));
  }
  result.vendorCount = targets.length;
  if (targets.length === 0) return result;

  const { subject, body } = payload;
  const templateName = process.env.WHATSAPP_BID_TEMPLATE_NAME?.trim() || null;
  const templateLanguage = process.env.WHATSAPP_BID_TEMPLATE_LANGUAGE?.trim() || "en";

  for (const vendor of targets) {
    const to = resolveWhatsAppRecipient(vendor);
    if (!to) {
      result.skipped += 1;
      console.warn(
        `[broadcast] ${payload.indentNumber} -> ${vendor.name}: skipped (no WhatsApp/phone number)`
      );
      continue;
    }

    await openQuoteSession(vendor.id, indentId);

    const send = await deliverNow({
      channel: "WHATSAPP",
      to,
      subject,
      body,
      entityType: "INDENT",
      entityId: indentId,
      buttons: templateName
        ? undefined
        : [{ id: buildQuoteButtonId(indentId), title: WHATSAPP_QUOTE_BUTTON_TITLE }],
      templateName,
      templateLanguage,
      templateParameters: templateName
        ? [
            payload.indentNumber,
            indent.loading?.city ?? "—",
            body.split("\n").find((line) => line.startsWith("Route:"))?.replace(/\*/g, "") ?? body.slice(0, 200),
          ]
        : undefined,
    });
    result.notified += 1;

    if (send.ok) {
      result.sent += 1;
    } else {
      result.failed += 1;
      console.error(
        `[broadcast] ${payload.indentNumber} -> vendor=${vendor.name} phone=${to} indent=${indentId} failed: ${send.detail}`
      );
    }
  }

  return result;
}

