import {
  requireAuth,
  isInternalRole,
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { activeProvider, deliverNow } from "@/lib/notify";
import { buildIndentBidPayload } from "@/lib/services/broadcast.service";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";

/**
 * WhatsApp integration health check: active provider, whether the credentials
 * are present, the exact callback URL to paste into Meta, plus the outbox
 * delivery counters and the most recent failures (with Meta's reason).
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!isInternalRole(auth.user.role)) return forbidden();

  try {
    const base = (process.env.PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");

    const [counts, failures, pending, recentInbound] = await Promise.all([
      prisma.notification.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.notification.findMany({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, to: true, subject: true, error: true, attempts: true, createdAt: true },
      }),
      prisma.notification.count({ where: { status: "PENDING" } }),
      prisma.whatsAppInboundEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { messageId: true, quoteId: true, result: true, createdAt: true },
      }),
    ]);

    return ok({
      provider: activeProvider(),
      configured: {
        token: Boolean(process.env.WHATSAPP_TOKEN),
        phoneNumberId: process.env.WHATSAPP_PHONE_ID ?? null,
        verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
        appSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
      },
      webhookCallbackUrl: base ? `${base}/api/webhooks/whatsapp/quotes` : null,
      delivery: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      pending,
      recentFailures: failures,
      recentInbound,
    });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Sends a live test message. Pass `indentId` to render the exact vendor bid
 * message for that indent; otherwise a plain ping is sent. The provider's
 * response — including Meta error codes — is returned inline, so configuration
 * problems surface immediately while the number is being set up.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!isInternalRole(auth.user.role)) return forbidden();

  try {
    const body = await req.json().catch(() => ({}));

    // Normalized on the way in, so a test send proves the stored format works.
    const to = normalizePhone(body.to);
    if (!to) {
      return badRequest("Provide a valid `to` number, e.g. 9820012345 or +919820012345");
    }

    let subject = "TMS WhatsApp test";
    let text = "ShunLink test message. Your TMS WhatsApp channel is connected.";
    let entityId: string | null = null;

    if (body.indentId) {
      const payload = await buildIndentBidPayload(String(body.indentId));
      if (!payload) return notFound("Indent not found");
      subject = payload.subject;
      text = payload.body;
      entityId = String(body.indentId);
    }

    const result = await deliverNow({
      channel: "WHATSAPP",
      to,
      subject,
      body: text,
      entityType: entityId ? "INDENT" : null,
      entityId,
    });

    return ok({ ...result, provider: activeProvider(), to, subject, body: text });
  } catch (e) {
    return serverError(e);
  }
}
