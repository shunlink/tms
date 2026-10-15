import type { SendResult } from "../notify";

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

export async function sendResendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      ok: false,
      provider: "resend",
      detail: "Email not configured (RESEND_API_KEY / MAIL_FROM missing)",
    };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });

    if (result.error) {
      return { ok: false, provider: "resend", detail: result.error.message };
    }

    return {
      ok: true,
      provider: "resend",
      detail: result.data?.id ? `accepted (id ${result.data.id})` : "accepted",
    };
  } catch (e) {
    return {
      ok: false,
      provider: "resend",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
