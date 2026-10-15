/**
 * Warns when WhatsApp inbound webhooks cannot reach this machine.
 * Meta delivers vendor replies to PUBLIC_BASE_URL — for local dev that must be
 * an ngrok (or similar) tunnel forwarding to `next dev`.
 */
import { loadEnv } from "./load-env.mjs";

loadEnv();

const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

if (!base || !/localhost|127\.0\.0\.1/i.test(base)) {
  if (base.includes("ngrok")) {
    try {
      const res = await fetch("http://127.0.0.1:4040/api/tunnels", { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`ngrok API ${res.status}`);
      const data = await res.json();
      const https = (data.tunnels ?? []).find((t) => t.public_url?.startsWith("https://"));
      const tunnelUrl = https?.public_url?.replace(/\/+$/, "");
      if (!tunnelUrl) {
        console.warn(
          "\n[whatsapp] ngrok is not running. Vendor WhatsApp replies will NOT reach this app.\n" +
            "  Run: npm run tunnel\n" +
            `  Then set PUBLIC_BASE_URL to the https URL and configure Meta webhook:\n` +
            `  <ngrok-url>/api/webhooks/whatsapp/quotes\n`
        );
      } else if (tunnelUrl !== base) {
        console.warn(
          `\n[whatsapp] PUBLIC_BASE_URL mismatch.\n` +
            `  .env:  ${base}\n` +
            `  ngrok: ${tunnelUrl}\n` +
            "  Update PUBLIC_BASE_URL and the Meta webhook callback URL.\n"
        );
      } else {
        console.info(`[whatsapp] Tunnel OK — inbound webhooks: ${base}/api/webhooks/whatsapp/quotes`);
      }
    } catch {
      console.warn(
        "\n[whatsapp] PUBLIC_BASE_URL points to ngrok but no tunnel is active on :4040.\n" +
          "  Run: npm run tunnel   (keep it running while testing vendor replies)\n"
      );
    }
  }
}
