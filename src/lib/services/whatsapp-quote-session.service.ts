import { prisma } from "../prisma";
import { isIndentOpenForVendorQuoting } from "../indent-vendor-visibility";

export type QuoteSessionStatus = "OPEN" | "AWAITING_AMOUNT" | "CLOSED";

export type QuotingIndentRef = {
  id: string;
  indentNumber: string;
  status: string;
  vendorId: string | null;
};

const ACTIVE_STATUSES: QuoteSessionStatus[] = ["OPEN", "AWAITING_AMOUNT"];

/** Opens (or reopens) a quote session when an indent is released to a vendor on WhatsApp. */
export async function openQuoteSession(vendorId: string, indentId: string) {
  const existing = await prisma.vendorQuote.findUnique({
    where: { indentId_vendorId: { indentId, vendorId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.whatsAppQuoteSession.upsert({
      where: { vendorId_indentId: { vendorId, indentId } },
      create: { vendorId, indentId, status: "CLOSED", closedAt: new Date() },
      update: { status: "CLOSED", closedAt: new Date() },
    });
    return null;
  }

  return prisma.whatsAppQuoteSession.upsert({
    where: { vendorId_indentId: { vendorId, indentId } },
    create: { vendorId, indentId, status: "OPEN" },
    update: { status: "OPEN", closedAt: null },
  });
}

export async function markSessionAwaitingAmount(vendorId: string, indentId: string) {
  const session = await prisma.whatsAppQuoteSession.findUnique({
    where: { vendorId_indentId: { vendorId, indentId } },
  });
  if (!session || session.status === "CLOSED") return null;

  return prisma.whatsAppQuoteSession.update({
    where: { id: session.id },
    data: { status: "AWAITING_AMOUNT" },
  });
}

export async function closeQuoteSession(vendorId: string, indentId: string) {
  const session = await prisma.whatsAppQuoteSession.findUnique({
    where: { vendorId_indentId: { vendorId, indentId } },
  });
  if (!session) return null;

  return prisma.whatsAppQuoteSession.update({
    where: { id: session.id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
}

export async function getSession(vendorId: string, indentId: string) {
  return prisma.whatsAppQuoteSession.findUnique({
    where: { vendorId_indentId: { vendorId, indentId } },
    include: { indent: { select: { indentNumber: true, status: true, vendorId: true } } },
  });
}

/** Active sessions for a vendor that are waiting for a numeric amount reply. */
export async function listAwaitingAmountSessions(vendorId: string) {
  return prisma.whatsAppQuoteSession.findMany({
    where: { vendorId, status: "AWAITING_AMOUNT" },
    include: { indent: { select: { id: true, indentNumber: true, status: true, vendorId: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

/** Sessions opened by broadcast but vendor has not tapped Submit my quote yet. */
export async function listOpenSessions(vendorId: string) {
  return prisma.whatsAppQuoteSession.findMany({
    where: { vendorId, status: "OPEN" },
    include: { indent: { select: { id: true, indentNumber: true, status: true, vendorId: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

/** All indents released to this vendor that are still open for quoting. */
export async function listQuotingIndentsForVendor(vendorId: string): Promise<QuotingIndentRef[]> {
  const releases = await prisma.indentVendorRelease.findMany({
    where: {
      vendorId,
      indent: {
        status: { in: ["RELEASED_TO_VENDORS", "QUOTING"] },
        vendorId: null,
      },
    },
    orderBy: { releasedAt: "desc" },
    include: {
      indent: { select: { id: true, indentNumber: true, status: true, vendorId: true } },
    },
  });

  const seen = new Set<string>();
  const out: QuotingIndentRef[] = [];
  for (const release of releases) {
    const indent = release.indent;
    if (!isIndentOpenForVendorQuoting(indent) || seen.has(indent.id)) continue;
    seen.add(indent.id);
    out.push(indent);
  }
  return out;
}

/**
 * Fallback when vendor sends a bare amount with no active session: match the
 * most recently released indent that is still open for quoting.
 */
export async function findMostRecentReleasedOpenIndent(vendorId: string) {
  const indents = await listQuotingIndentsForVendor(vendorId);
  return indents[0] ?? null;
}

/**
 * Pick the indent a bare amount reply belongs to.
 * Prefers an explicit awaiting session, then a single open session / released indent.
 */
export async function resolveIndentForAmountReply(vendorId: string): Promise<{
  indent: QuotingIndentRef | null;
  reason?: "none" | "multiple";
  candidates?: QuotingIndentRef[];
}> {
  const awaiting = await listAwaitingAmountSessions(vendorId);
  const awaitingOpen = awaiting.filter((s) => isIndentOpenForVendorQuoting(s.indent));
  if (awaitingOpen.length === 1) {
    return { indent: awaitingOpen[0].indent };
  }
  if (awaitingOpen.length > 1) {
    return {
      indent: null,
      reason: "multiple",
      candidates: awaitingOpen.map((s) => s.indent),
    };
  }

  const openSessions = await listOpenSessions(vendorId);
  const openForQuoting = openSessions.filter((s) => isIndentOpenForVendorQuoting(s.indent));
  if (openForQuoting.length === 1) {
    await markSessionAwaitingAmount(vendorId, openForQuoting[0].indent.id);
    return { indent: openForQuoting[0].indent };
  }
  if (openForQuoting.length > 1) {
    return {
      indent: null,
      reason: "multiple",
      candidates: openForQuoting.map((s) => s.indent),
    };
  }

  const quotingIndents = await listQuotingIndentsForVendor(vendorId);
  if (quotingIndents.length === 1) {
    await openQuoteSession(vendorId, quotingIndents[0].id);
    await markSessionAwaitingAmount(vendorId, quotingIndents[0].id);
    return { indent: quotingIndents[0] };
  }
  if (quotingIndents.length > 1) {
    return { indent: null, reason: "multiple", candidates: quotingIndents };
  }

  return { indent: null, reason: "none" };
}

export async function isSessionOpenForQuoting(vendorId: string, indentId: string) {
  const session = await prisma.whatsAppQuoteSession.findUnique({
    where: { vendorId_indentId: { vendorId, indentId } },
    select: { status: true },
  });
  return session ? ACTIVE_STATUSES.includes(session.status as QuoteSessionStatus) : false;
}

/** Records a processed webhook message id; returns false when this id was already handled. */
export async function claimInboundEvent(messageId: string): Promise<boolean> {
  if (!messageId) return true;
  try {
    await prisma.whatsAppInboundEvent.create({ data: { messageId } });
    return true;
  } catch {
    return false;
  }
}

export async function completeInboundEvent(
  messageId: string | null,
  input: { quoteId?: string | null; result?: string | null }
) {
  if (!messageId) return;
  await prisma.whatsAppInboundEvent.update({
    where: { messageId },
    data: { quoteId: input.quoteId ?? null, result: input.result ?? null },
  }).catch(() => null);
}
