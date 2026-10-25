import { prisma } from "./prisma";
import { normalizePhone } from "./phone";

import { readJsonBody } from "@/lib/api-client";
export type SendResult = {
  ok: boolean;
  provider: string;
  /** Provider response detail: message id on success, reason on failure. */
  detail?: string;
  /** Meta error code, when the Cloud API rejected the message. */
  errorCode?: number | null;
};

export function activeProvider() {
  return process.env.NOTIFY_PROVIDER ?? "console";
}

const GRAPH_VERSION = "v20.0";

/**
 * Plain-English explanation for the Meta Cloud API error codes we actually hit.
 * Mirrored into the notification `error` column so failures are self-diagnosing.
 */
const META_ERROR_HINTS: Record<number, string> = {
  190: "access token is invalid or expired — regenerate WHATSAPP_TOKEN",
  100: "invalid request — check WHATSAPP_PHONE_ID and the payload",
  131008: "a required parameter is missing",
  131009: "a parameter value is not valid",
  131026: "this number cannot receive WhatsApp messages (not on WhatsApp, or the business number is not verified)",
  131030:
    "recipient is not in the test-number allow list (add it under Meta > WhatsApp > API Setup > 'To'), or the recipient must message your business number first",
  131047:
    "24-hour re-engagement window closed — business-initiated messages need an approved message template",
  133010: "WhatsApp Business account is not registered / phone number not verified",
};

export function explainMetaError(code?: number | null): string | null {
  if (code == null) return null;
  return META_ERROR_HINTS[code] ?? null;
}

type MetaErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    error_data?: { details?: string };
    error_subcode?: number;
  };
  messages?: { id?: string }[];
};

type WhatsAppPayload =
  | { type: "text"; body: string }
  | {
      type: "interactive";
      body: string;
      buttons: Array<{ id: string; title: string }>;
    }
  | {
      type: "cta_url";
      body: string;
      displayText: string;
      url: string;
    }
  | {
      type: "template";
      templateName: string;
      languageCode: string;
      bodyParameters: string[];
      buttonUrlParameter?: string | null;
    };

function buildWhatsAppRequestBody(to: string, payload: WhatsAppPayload) {
  if (payload.type === "template") {
    const components: Array<Record<string, unknown>> = [];
    if (payload.bodyParameters.length) {
      components.push({
        type: "body",
        parameters: payload.bodyParameters.map((text) => ({ type: "text", text })),
      });
    }
    if (payload.buttonUrlParameter) {
      components.push({
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: payload.buttonUrlParameter }],
      });
    }
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: payload.templateName,
        language: { code: payload.languageCode },
        components: components.length ? components : undefined,
      },
    };
  }

  if (payload.type === "cta_url") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: { text: payload.body },
        action: {
          name: "cta_url",
          parameters: {
            display_text: payload.displayText,
            url: payload.url,
          },
        },
      },
    };
  }

  if (payload.type === "interactive") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: payload.body },
        action: {
          buttons: payload.buttons.map((button) => ({
            type: "reply",
            reply: { id: button.id, title: button.title },
          })),
        },
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: payload.body, preview_url: false },
  };
}

async function sendWhatsAppCloud(toRaw: string, payload: WhatsAppPayload): Promise<SendResult> {
  const provider = activeProvider();
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    return {
      ok: false,
      provider,
      detail: "WhatsApp Cloud API not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID missing)",
    };
  }

  const to = normalizePhone(toRaw);
  if (!to) {
    return {
      ok: false,
      provider,
      detail: `Invalid recipient number "${toRaw}" — expected a 10-digit number or a full international number`,
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildWhatsAppRequestBody(to, payload)),
    });

    const responsePayload = (await readJsonBody(res)) as MetaErrorPayload | null;

    if (!res.ok) {
      const err = responsePayload?.error;
      const message = (err?.message ?? "").replace(/^\(#\d+\)\s*/, "").trim();
      const details = (err?.error_data?.details ?? "").trim();
      const reason = details && message && details.startsWith(message) ? details : message || details;
      const hint = explainMetaError(err?.code);
      const detail = [
        err?.code != null ? `#${err.code}` : `HTTP ${res.status}`,
        reason,
        hint ? `Hint: ${hint}` : null,
      ]
        .filter((p): p is string => !!p && p.length > 0)
        .join(" — ");
      return { ok: false, provider, detail: detail || `HTTP ${res.status}`, errorCode: err?.code ?? null };
    }

    const wamid = responsePayload?.messages?.[0]?.id;
    return {
      ok: true,
      provider,
      detail: wamid ? `accepted by Meta (message id ${wamid})` : "accepted by Meta",
    };
  } catch (e) {
    return {
      ok: false,
      provider,
      detail: `Network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function sendMessage(msg: {
  channel: string;
  to: string;
  subject?: string | null;
  body: string;
  html?: string | null;
}): Promise<SendResult> {
  const provider = activeProvider();

  if (msg.channel === "EMAIL") {
    const { sendResendEmail, emailEnabled } = await import("./email/resend");
    if (!emailEnabled()) {
      console.log(`[notify:EMAIL] -> ${msg.to} :: ${msg.subject ?? ""} ${msg.body}`);
      return { ok: true, provider: "console", detail: "email logged (Resend not configured)" };
    }
    return sendResendEmail({
      to: msg.to,
      subject: msg.subject ?? "TMS Notification",
      html: msg.html ?? `<p>${msg.body.replace(/\n/g, "<br/>")}</p>`,
      text: msg.body,
    });
  }

  if (provider === "whatsapp_cloud") {
    return sendWhatsAppCloud(msg.to, { type: "text", body: msg.body });
  }

  console.log(`[notify:${msg.channel}] -> ${msg.to} :: ${msg.body}`);
  return { ok: true, provider: "console", detail: "logged by console provider" };
}

export async function sendInteractiveMessage(msg: {
  channel: string;
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
}): Promise<SendResult> {
  const provider = activeProvider();

  if (provider === "whatsapp_cloud") {
    return sendWhatsAppCloud(msg.to, {
      type: "interactive",
      body: msg.body,
      buttons: msg.buttons,
    });
  }

  const buttonSummary = msg.buttons.map((b) => `${b.title}(${b.id})`).join(", ");
  console.log(`[notify:${msg.channel}:interactive] -> ${msg.to} :: ${msg.body} [${buttonSummary}]`);
  return { ok: true, provider: "console", detail: "logged by console provider" };
}

export async function sendCtaUrlMessage(msg: {
  channel: string;
  to: string;
  body: string;
  displayText: string;
  url: string;
}): Promise<SendResult> {
  const provider = activeProvider();

  if (provider === "whatsapp_cloud") {
    return sendWhatsAppCloud(msg.to, {
      type: "cta_url",
      body: msg.body,
      displayText: msg.displayText,
      url: msg.url,
    });
  }

  console.log(
    `[notify:${msg.channel}:cta_url] -> ${msg.to} :: ${msg.displayText} => ${msg.url}`
  );
  return { ok: true, provider: "console", detail: "logged by console provider" };
}

export async function sendTemplateMessage(msg: {
  channel: string;
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
  buttonUrlParameter?: string | null;
}): Promise<SendResult> {
  const provider = activeProvider();

  if (provider === "whatsapp_cloud") {
    return sendWhatsAppCloud(msg.to, {
      type: "template",
      templateName: msg.templateName,
      languageCode: msg.languageCode ?? process.env.WHATSAPP_BID_TEMPLATE_LANGUAGE ?? "en",
      bodyParameters: msg.bodyParameters ?? [],
      buttonUrlParameter: msg.buttonUrlParameter ?? null,
    });
  }

  console.log(
    `[notify:${msg.channel}:template] -> ${msg.to} :: ${msg.templateName} (${(msg.bodyParameters ?? []).join(" | ")})`
  );
  return { ok: true, provider: "console", detail: "logged by console provider" };
}

type OutboundMessage = {
  channel: string;
  to: string;
  subject?: string | null;
  body: string;
  html?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  buttons?: Array<{ id: string; title: string }>;
  ctaUrl?: { url: string; displayText: string } | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateParameters?: string[];
  templateButtonUrlParameter?: string | null;
};

async function dispatchOutbound(msg: OutboundMessage) {
  if (msg.templateName) {
    return sendTemplateMessage({
      channel: msg.channel,
      to: msg.to,
      templateName: msg.templateName,
      languageCode: msg.templateLanguage ?? undefined,
      bodyParameters: msg.templateParameters,
      buttonUrlParameter: msg.templateButtonUrlParameter ?? null,
    });
  }
  if (msg.ctaUrl) {
    return sendCtaUrlMessage({
      channel: msg.channel,
      to: msg.to,
      body: msg.body,
      displayText: msg.ctaUrl.displayText,
      url: msg.ctaUrl.url,
    });
  }
  if (msg.buttons?.length) {
    return sendInteractiveMessage({
      channel: msg.channel,
      to: msg.to,
      body: msg.body,
      buttons: msg.buttons,
    });
  }
  return sendMessage({
    channel: msg.channel,
    to: msg.to,
    subject: msg.subject,
    body: msg.body,
    html: msg.html,
  });
}

/** Enqueue or send an email notification. */
export async function deliverEmail(msg: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const row = await prisma.notification.create({
    data: {
      channel: "EMAIL",
      to: msg.to,
      subject: msg.subject,
      body: msg.body,
      entityType: msg.entityType ?? null,
      entityId: msg.entityId ?? null,
      status: "PENDING",
    },
  });

  const { enqueueEmailJob } = await import("./queue/email.queue");
  const queued = await enqueueEmailJob({
    notificationId: row.id,
    to: msg.to,
    subject: msg.subject,
    body: msg.body,
    html: msg.html,
  });

  if (queued) {
    return { ok: true, notificationId: row.id, queued: true };
  }

  const result = await sendMessage({
    channel: "EMAIL",
    to: msg.to,
    subject: msg.subject,
    body: msg.body,
    html: msg.html,
  });

  await prisma.notification.update({
    where: { id: row.id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      sentAt: result.ok ? new Date() : null,
      attempts: { increment: 1 },
      error: result.ok ? null : result.detail ?? "Unknown error",
    },
  });

  return { ok: result.ok, notificationId: row.id, queued: false, detail: result.detail };
}

/**
 * Records an outbox row and sends it immediately, persisting the provider
 * outcome (status, attempt count, error). This is the single place outbound
 * messages leave the system from, so delivery state is always auditable.
 */
export async function deliverNow(msg: OutboundMessage) {
  if (msg.channel === "EMAIL") {
    return deliverEmail({
      to: msg.to,
      subject: msg.subject ?? "TMS Notification",
      body: msg.body,
      html: msg.html ?? undefined,
      entityType: msg.entityType,
      entityId: msg.entityId,
    });
  }

  const row = await prisma.notification.create({
    data: {
      channel: msg.channel,
      to: msg.to,
      subject: msg.subject ?? null,
      body: msg.body,
      entityType: msg.entityType ?? null,
      entityId: msg.entityId ?? null,
      status: "PENDING",
    },
  });

  const result = await dispatchOutbound(msg);

  await prisma.notification.update({
    where: { id: row.id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      sentAt: result.ok ? new Date() : null,
      attempts: { increment: 1 },
      error: result.ok ? null : result.detail ?? "Unknown error",
    },
  });

  if (!result.ok) {
    console.error(
      `[notify] WhatsApp send failed -> to=${msg.to} entity=${msg.entityType ?? "—"}/${msg.entityId ?? "—"}: ${result.detail}`
    );
  }

  return { ok: result.ok, detail: result.detail, notificationId: row.id };
}

/**
 * Sends everything still queued. Rows are only queued when an immediate send
 * was not possible, so this is a safety net rather than the primary path.
 */
export async function processOutbox() {
  const pending = await prisma.notification.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let sent = 0;
  let failed = 0;
  for (const n of pending) {
    const result = await sendMessage({
      channel: n.channel,
      to: n.to,
      subject: n.subject,
      body: n.body,
      html: n.channel === "EMAIL" ? `<p>${n.body.replace(/\n/g, "<br/>")}</p>` : undefined,
    });
    await prisma.notification.update({
      where: { id: n.id },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        sentAt: result.ok ? new Date() : null,
        attempts: { increment: 1 },
        error: result.ok ? null : result.detail ?? "Unknown error",
      },
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return { processed: pending.length, sent, failed, provider: activeProvider() };
}


