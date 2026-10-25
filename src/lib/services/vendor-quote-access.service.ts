import crypto from "crypto";
import { prisma } from "../prisma";
import { isIndentOpenForVendorQuoting } from "../indent-vendor-visibility";
import { isVendorReleasedIndent } from "./release.service";
import { openQuoteSession } from "./whatsapp-quote-session.service";
import { buildVendorQuoteAccessUrl } from "../vendor-quote-portal-url";
import { resolveIndentPromisedAdvanceAmount, tripAdvanceSummarySelect } from "../advance";

const ACCESS_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function newAccessToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function accessTokenStillValid(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() > Date.now();
}

export type PublicVendorQuoteIndent = {
  id: string;
  indentNumber: string;
  client: string;
  route: string;
  vehicleType: string;
  pickupAt: string | null;
  deliveryAt: string | null;
  weightLabel: string | null;
  cargoLabel: string | null;
  advanceAmount: number | null;
  status: string;
};

export type PublicVendorQuoteView =
  | {
      ok: true;
      vendorName: string;
      indent: PublicVendorQuoteIndent;
      canSubmit: boolean;
      existingQuote: {
        quotedRate: number;
        channel: string;
        submittedAt: string;
      } | null;
      closedReason: string | null;
    }
  | { ok: false; reason: "not_found" | "expired" };

/** Mint or reuse a quote-page link for a released vendor + open indent. */
export async function ensureVendorQuoteAccess(vendorId: string, indentId: string) {
  const released = await isVendorReleasedIndent(vendorId, indentId);
  if (!released) return null;

  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    select: { id: true, status: true, vendorId: true },
  });
  if (!indent || !isIndentOpenForVendorQuoting(indent)) return null;

  await openQuoteSession(vendorId, indentId);

  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const existing = await prisma.whatsAppQuoteSession.findUnique({
    where: { vendorId_indentId: { vendorId, indentId } },
    select: { accessToken: true, accessTokenExpiresAt: true },
  });

  let accessToken = existing?.accessToken ?? null;
  if (!accessToken || !accessTokenStillValid(existing?.accessTokenExpiresAt)) {
    accessToken = newAccessToken();
  }

  await prisma.whatsAppQuoteSession.upsert({
    where: { vendorId_indentId: { vendorId, indentId } },
    create: {
      vendorId,
      indentId,
      accessToken,
      accessTokenExpiresAt: expiresAt,
      status: "OPEN",
    },
    update: {
      accessToken,
      accessTokenExpiresAt: expiresAt,
    },
  });

  const url = buildVendorQuoteAccessUrl(accessToken);
  return { accessToken, url };
}

async function mapIndentForPublicPage(indentId: string): Promise<PublicVendorQuoteIndent | null> {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    include: {
      client: { select: { name: true } },
      consignment: true,
      cargo: { select: { description: true } },
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      payments: { where: { paymentType: "ADVANCE" }, orderBy: { paidAt: "desc" }, take: 1 },
      trips: {
        select: { advanceRequests: { select: tripAdvanceSummarySelect } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!indent) return null;

  const from = [indent.loading?.city, indent.loading?.state].filter(Boolean).join(", ");
  const to = [indent.unloading?.city, indent.unloading?.state].filter(Boolean).join(", ");
  const route = from && to ? `${from} → ${to}` : from || to || "—";

  const weightValue = indent.consignment?.weightValue?.toNumber() ?? null;
  const weightUnit = indent.consignment?.weightUnit ?? "MT";
  const weightLabel =
    weightValue != null && weightValue > 0 ? `${weightValue} ${weightUnit}` : null;

  const cargoParts = [indent.consignment?.cargoTypeCode, indent.cargo?.description].filter(Boolean);
  const cargoLabel = cargoParts.length ? cargoParts.join(" · ") : null;

  return {
    id: indent.id,
    indentNumber: indent.indentNumber,
    client: indent.client?.name ?? "—",
    route,
    vehicleType: indent.consignment?.vehicleTypeCode ?? "—",
    pickupAt: indent.consignment?.pickupAt?.toISOString() ?? null,
    deliveryAt: indent.consignment?.deliveryAt?.toISOString() ?? null,
    weightLabel,
    cargoLabel,
    advanceAmount: resolveIndentPromisedAdvanceAmount(indent),
    status: indent.status,
  };
}

export async function getPublicVendorQuoteView(accessToken: string): Promise<PublicVendorQuoteView> {
  const token = accessToken.trim();
  if (!token) return { ok: false, reason: "not_found" };

  const session = await prisma.whatsAppQuoteSession.findFirst({
    where: { accessToken: token },
    include: {
      vendor: { select: { id: true, name: true, isActive: true, deletedAt: true } },
      indent: { select: { id: true, indentNumber: true, status: true, vendorId: true } },
    },
  });
  if (!session?.vendor || !session.indent) return { ok: false, reason: "not_found" };
  if (!accessTokenStillValid(session.accessTokenExpiresAt)) return { ok: false, reason: "expired" };
  if (!session.vendor.isActive || session.vendor.deletedAt) return { ok: false, reason: "not_found" };

  const indentRow = await mapIndentForPublicPage(session.indentId);
  if (!indentRow) return { ok: false, reason: "not_found" };

  const existing = await prisma.vendorQuote.findUnique({
    where: {
      indentId_vendorId: { indentId: session.indentId, vendorId: session.vendorId },
    },
    select: { quotedRate: true, channel: true, submittedAt: true, status: true },
  });

  const open = isIndentOpenForVendorQuoting(session.indent);
  const released = await isVendorReleasedIndent(session.vendorId, session.indentId);
  let closedReason: string | null = null;
  if (!open) closedReason = "This load is no longer open for quoting.";
  else if (!released) closedReason = "This quote link is no longer valid for your account.";

  const activeQuote =
    existing && ["ACTIVE", "ACCEPTED"].includes(existing.status)
      ? {
          quotedRate: existing.quotedRate.toNumber(),
          channel: existing.channel,
          submittedAt: existing.submittedAt.toISOString(),
        }
      : null;

  return {
    ok: true,
    vendorName: session.vendor.name,
    indent: indentRow,
    canSubmit: open && released && !activeQuote,
    existingQuote: activeQuote,
    closedReason,
  };
}

export async function resolveVendorQuoteAccessToken(accessToken: string) {
  const token = accessToken.trim();
  if (!token) return null;

  const session = await prisma.whatsAppQuoteSession.findFirst({
    where: { accessToken: token },
    include: {
      vendor: {
        select: { id: true, name: true, phone: true, whatsapp: true, isActive: true, deletedAt: true },
      },
      indent: { select: { id: true, indentNumber: true, status: true, vendorId: true } },
    },
  });
  if (!session?.vendor || !session.indent) return null;
  if (!accessTokenStillValid(session.accessTokenExpiresAt)) return null;
  if (!session.vendor.isActive || session.vendor.deletedAt) return null;

  return session;
}
