import { ingestPaymentWebhook } from "@/lib/payments/webhook.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const result = await ingestPaymentWebhook(req);
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.message }), {
        status: result.status,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook processing failed";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
