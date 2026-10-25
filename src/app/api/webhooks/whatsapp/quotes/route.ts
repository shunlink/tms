import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseQuoteButtonId, parseQuoteMessage } from "@/lib/whatsapp-parse";
import { deliverNow } from "@/lib/notify";
import { normalizePhone, phonesMatch } from "@/lib/phone";
import { isIndentOpenForVendorQuoting } from "@/lib/indent-vendor-visibility";
import {
  buildMultipleIndentsMessage,
  buildNoActiveIndentMessage,
  buildPortalQuoteRedirectMessage,
  buildQuoteAlreadySubmittedMessage,
} from "@/lib/whatsapp-message";
import { buildVendorOpenIndentsLoginUrl, buildVendorQuoteLoginUrl } from "@/lib/vendor-quote-portal-url";
import { ensureVendorQuoteAccess } from "@/lib/services/vendor-quote-access.service";
import {
  claimInboundEvent,
  completeInboundEvent,
  resolveIndentForAmountReply,
} from "@/lib/services/whatsapp-quote-session.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function signatureVerificationEnabled() {
  const skip = (process.env.WHATSAPP_WEBHOOK_SKIP_SIGNATURE ?? "").trim().toLowerCase();
  if (skip === "1" || skip === "true" || skip === "yes") return false;
  return Boolean(process.env.WHATSAPP_APP_SECRET?.trim());
}

function isSignatureValid(rawBody: string, header: string | null) {
  if (!signatureVerificationEnabled()) return true;
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) return true;
  if (!header) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = header.replace(/^sha256=/, "").trim();
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function verifyTokenCandidates(): string[] {
  return [process.env.WHATSAPP_VERIFY_TOKEN, process.env.WHATSAPP_APP_SECRET]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("hub.mode") ?? "").trim();
  const token = (url.searchParams.get("hub.verify_token") ?? "").trim();
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const candidates = verifyTokenCandidates();
  const tokenMatches = token !== "" && candidates.some((candidate) => safeEqual(candidate, token));

  if (mode === "subscribe" && tokenMatches && challenge !== "") {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  if (mode === "subscribe") {
    console.warn(
      `[whatsapp] webhook verification rejected: tokenProvided=${token !== ""} challengeProvided=${challenge !== ""} configuredTokens=${candidates.length}`
    );
  }
  return new Response("Forbidden", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

type InboundMessage = {
  from: string;
  messageId: string | null;
  profileName: string | null;
  kind: "text" | "button";
  text: string;
  buttonId?: string | null;
};

type InboundResult = {
  from: string;
  ok: boolean;
  indentNumber?: string;
  error?: string;
  duplicate?: boolean;
};

type MetaValue = {
  contacts?: Array<{ profile?: { name?: string } }>;
  messages?: Array<{
    from?: string;
    id?: string;
    type?: string;
    text?: { body?: string };
    button?: { text?: string; payload?: string };
    interactive?: {
      type?: string;
      button_reply?: { id?: string; title?: string };
    };
  }>;
};

function extractInboundMessages(body: Record<string, unknown>): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = body.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: MetaValue }).value;
      if (!value?.messages) continue;
      const profileName = value.contacts?.[0]?.profile?.name ?? null;
      for (const message of value.messages) {
        if (message.type === "text" && message.text?.body) {
          out.push({
            from: String(message.from ?? ""),
            text: message.text.body,
            messageId: message.id ?? null,
            profileName,
            kind: "text",
          });
          continue;
        }
        if (message.type === "button" && message.button?.payload) {
          out.push({
            from: String(message.from ?? ""),
            text: message.button.text ?? message.button.payload,
            messageId: message.id ?? null,
            profileName,
            kind: "button",
            buttonId: message.button.payload,
          });
          continue;
        }
        if (message.type === "interactive" && message.interactive?.type === "button_reply") {
          const reply = message.interactive.button_reply;
          out.push({
            from: String(message.from ?? ""),
            text: reply?.title ?? "",
            messageId: message.id ?? null,
            profileName,
            kind: "button",
            buttonId: reply?.id ?? null,
          });
        }
      }
    }
  }
  return out.filter((m) => m.from !== "");
}

async function findVendorByPhone(from: string) {
  const digits = normalizePhone(from);
  if (!digits) return null;

  const exact = await prisma.vendor.findFirst({
    where: { isActive: true, OR: [{ whatsapp: digits }, { phone: digits }] },
  });
  if (exact) return exact;

  const tail = digits.slice(-10);
  if (tail.length !== 10) return null;

  const candidates = await prisma.vendor.findMany({
    where: {
      isActive: true,
      OR: [
        { whatsapp: { endsWith: tail } },
        { phone: { endsWith: tail } },
        { whatsapp: tail },
        { phone: tail },
      ],
    },
  });

  return (
    candidates.find((v) => phonesMatch(v.whatsapp, digits) || phonesMatch(v.phone, digits)) ?? null
  );
}

async function sendVendorText(to: string, body: string, entityId?: string | null) {
  await deliverNow({
    channel: "WHATSAPP",
    to,
    subject: "ShunLink TMS",
    body,
    entityType: entityId ? "INDENT" : null,
    entityId: entityId ?? null,
  });
}

async function quotePageUrlForVendor(vendorId: string, indentId: string): Promise<string | null> {
  try {
    const access = await ensureVendorQuoteAccess(vendorId, indentId);
    if (access?.url) return access.url;
    return buildVendorQuoteLoginUrl(indentId);
  } catch {
    return null;
  }
}

async function handleQuoteButton(
  vendor: { id: string },
  message: InboundMessage,
  indentId: string
): Promise<InboundResult> {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    select: { id: true, indentNumber: true, status: true, vendorId: true },
  });
  if (!indent || !isIndentOpenForVendorQuoting(indent)) {
    return { from: message.from, ok: false, error: "Indent is no longer open for quoting" };
  }

  const existing = await prisma.vendorQuote.findUnique({
    where: { indentId_vendorId: { indentId: indent.id, vendorId: vendor.id } },
  });
  if (existing) {
    await sendVendorText(message.from, buildQuoteAlreadySubmittedMessage(indent.indentNumber), indent.id);
    return {
      from: message.from,
      ok: false,
      error: "Quote already submitted",
      indentNumber: indent.indentNumber,
      duplicate: true,
    };
  }

  const quotePageUrl = await quotePageUrlForVendor(vendor.id, indent.id);
  if (!quotePageUrl) {
    await sendVendorText(
      message.from,
      "Online quoting is not configured. Please contact ShunLink operations.",
      indent.id
    );
    return { from: message.from, ok: false, error: "Quote page URL not configured" };
  }

  await sendVendorText(
    message.from,
    buildPortalQuoteRedirectMessage(indent.indentNumber, quotePageUrl),
    indent.id
  );
  return { from: message.from, ok: true, indentNumber: indent.indentNumber };
}

async function handleTextQuote(
  vendor: { id: string },
  message: InboundMessage
): Promise<InboundResult> {
  const parsedFull = parseQuoteMessage(message.text);
  if (parsedFull) {
    const indent = await prisma.indent.findFirst({
      where: { indentNumber: parsedFull.indentNumber },
      select: { id: true, indentNumber: true, status: true, vendorId: true },
    });
    if (!indent) {
      return { from: message.from, ok: false, error: `Indent ${parsedFull.indentNumber} not found` };
    }
    if (!isIndentOpenForVendorQuoting(indent)) {
      return { from: message.from, ok: false, error: "Indent is no longer open for quoting" };
    }
    return handleQuoteButton(vendor, message, indent.id);
  }

  const resolved = await resolveIndentForAmountReply(vendor.id);

  if (resolved.reason === "multiple" && resolved.candidates?.length) {
    await sendVendorText(
      message.from,
      buildMultipleIndentsMessage(resolved.candidates.map((i) => i.indentNumber))
    );
    return { from: message.from, ok: false, error: "Multiple open indents — portal link guidance sent" };
  }

  if (resolved.indent) {
    const indentCheck = await prisma.indent.findFirst({
      where: { id: resolved.indent.id },
      select: { id: true, indentNumber: true, status: true, vendorId: true },
    });
    if (indentCheck && isIndentOpenForVendorQuoting(indentCheck)) {
      return handleQuoteButton(vendor, message, indentCheck.id);
    }
  }

  let fallbackUrl: string | null = null;
  try {
    fallbackUrl = buildVendorOpenIndentsLoginUrl();
  } catch {
    fallbackUrl = null;
  }

  if (fallbackUrl) {
    await sendVendorText(
      message.from,
      buildPortalQuoteRedirectMessage("your open load", fallbackUrl)
    );
  } else {
    await sendVendorText(message.from, buildNoActiveIndentMessage());
  }
  return { from: message.from, ok: true, error: "Portal redirect sent" };
}

async function handleInbound(message: InboundMessage): Promise<InboundResult> {
  let claimedMessageId: string | null = null;

  if (message.messageId) {
    const claimed = await claimInboundEvent(message.messageId);
    if (!claimed) {
      console.info(`[whatsapp] duplicate webhook ignored messageId=${message.messageId}`);
      return { from: message.from, ok: true, error: "Duplicate webhook ignored" };
    }
    claimedMessageId = message.messageId;
  }

  const finish = async (result: InboundResult) => {
    await completeInboundEvent(claimedMessageId, {
      quoteId: null,
      result: result.ok ? "ok" : result.error ?? "failed",
    });
    return result;
  };

  const vendor = await findVendorByPhone(message.from);
  if (!vendor) {
    const normalized = normalizePhone(message.from);
    const tail = normalized?.slice(-10);
    const nearMatches = tail
      ? await prisma.vendor.findMany({
          where: {
            isActive: true,
            OR: [{ whatsapp: { endsWith: tail } }, { phone: { endsWith: tail } }],
          },
          select: { name: true, phone: true, whatsapp: true },
          take: 5,
        })
      : [];
    console.warn(
      `[whatsapp] unknown vendor phone=${message.from} normalized=${normalized ?? "—"} messageId=${message.messageId ?? "—"} nearMatches=${nearMatches.length}`
    );
    return finish({ from: message.from, ok: false, error: "Unknown vendor" });
  }

  console.info(
    `[whatsapp] inbound vendor=${vendor.name} kind=${message.kind} text=${message.text.slice(0, 80)} messageId=${message.messageId ?? "—"}`
  );

  let result: InboundResult;
  if (message.kind === "button" && message.buttonId) {
    const indentId = parseQuoteButtonId(message.buttonId);
    if (!indentId) {
      result = { from: message.from, ok: false, error: "Unrecognized button action" };
    } else {
      result = await handleQuoteButton(vendor, message, indentId);
    }
  } else {
    result = await handleTextQuote(vendor, message);
  }

  if (!result.ok && !result.duplicate) {
    console.warn(
      `[whatsapp] inbound failed vendor=${vendor.name} phone=${message.from} indent=${result.indentNumber ?? "—"} error=${result.error}`
    );
  }

  return finish(result);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-hub-signature-256");

  console.info(
    `[whatsapp] webhook POST hit bodyLength=${rawBody.length} signed=${Boolean(signatureHeader)} verify=${signatureVerificationEnabled()}`
  );

  if (!isSignatureValid(rawBody, signatureHeader)) {
    console.error(
      `[whatsapp] signature rejected headerPresent=${Boolean(signatureHeader)} bodyLength=${rawBody.length} — ` +
        "WHATSAPP_APP_SECRET does not match Meta App Secret. " +
        "Copy App Secret from Meta > Settings > Basic into .env, or set WHATSAPP_WEBHOOK_SKIP_SIGNATURE=true for local dev."
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const isMetaEnvelope = Array.isArray(body.entry);
  const messages = extractInboundMessages(body);

  console.info(`[whatsapp] POST received messages=${messages.length} metaEnvelope=${isMetaEnvelope}`);

  if (messages.length === 0) {
    return isMetaEnvelope
      ? NextResponse.json({ ok: true, handled: 0 })
      : NextResponse.json({ error: "Missing from/text" }, { status: 400 });
  }

  const results: InboundResult[] = [];
  for (const message of messages) {
    try {
      results.push(await handleInbound(message));
    } catch (e) {
      const error = e instanceof Error ? e.message : "Webhook processing failed";
      console.error(`[whatsapp] inbound from ${message.from} failed: ${error}`);
      results.push({ from: message.from, ok: false, error });
    }
  }

  if (isMetaEnvelope) return NextResponse.json({ ok: true, results });

  const first = results[0];
  if (!first.ok && !first.duplicate) {
    const error = String(first.error ?? "Webhook processing failed");
    const status = error.includes("not found") || error.includes("Unknown vendor") ? 404 : 400;
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(first, { status: 200 });
}
