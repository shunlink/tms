/**
 * WhatsApp webhook infra diagnostics.
 * Run: npm run whatsapp:check
 */
import crypto from "crypto";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
const secret = process.env.WHATSAPP_APP_SECRET?.trim();
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
const webhookUrl = base ? `${base}/api/webhooks/whatsapp/quotes` : null;

let failed = 0;
const ok = (msg) => console.log(`[OK]   ${msg}`);
const fail = (msg) => {
  console.log(`[FAIL] ${msg}`);
  failed += 1;
};

console.log("\n=== WhatsApp infra check ===\n");
console.log("PUBLIC_BASE_URL:", base || "(not set)");
console.log("Webhook URL:    ", webhookUrl || "(set PUBLIC_BASE_URL in .env)");
console.log("VERIFY_TOKEN:   ", verifyToken ? "set" : "missing");
console.log("APP_SECRET:     ", secret ? "set" : "missing");

let tunnelUrl = null;
try {
  const res = await fetch("http://127.0.0.1:4040/api/tunnels", { signal: AbortSignal.timeout(3000) });
  if (res.ok) {
    const data = await res.json();
    tunnelUrl = data.tunnels?.find((t) => t.public_url?.startsWith("https://"))?.public_url?.replace(/\/+$/, "");
  }
} catch {
  fail("ngrok is not running — run: npm run tunnel");
}

if (tunnelUrl) {
  console.log("\nngrok tunnel:   ", tunnelUrl);
  if (!base) fail("PUBLIC_BASE_URL is empty in .env");
  else if (tunnelUrl !== base) fail(`PUBLIC_BASE_URL mismatch (.env=${base})`);
  else ok("PUBLIC_BASE_URL matches ngrok");
}

try {
  const health = await fetch("http://localhost:3000/api/health", { signal: AbortSignal.timeout(5000) });
  if (health.ok) ok("Dev server reachable on :3000");
  else fail("Dev server unhealthy");
} catch {
  fail("Dev server not running — run: npm run dev");
}

if (webhookUrl && verifyToken) {
  const challenge = `diag_${Date.now()}`;
  const verifyRes = await fetch(
    `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${challenge}`,
    { headers: { "User-Agent": "facebookexternalhit/1.1" }, signal: AbortSignal.timeout(15000) }
  ).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));

  const body = await verifyRes.text();
  if (verifyRes.ok && body === challenge) ok("Webhook verify via tunnel (Meta-style GET)");
  else if (body.includes("ERR_NGROK_6024") || body.includes("visit") && body.includes("ngrok")) {
    fail("ngrok browser warning is blocking webhook verify");
  } else fail(`Webhook verify HTTP ${verifyRes.status}: ${body.slice(0, 100)}`);
}

if (webhookUrl && secret) {
  const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  const postRes = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": sig,
      "User-Agent": "facebookexternalhit/1.1",
    },
    body: payload,
    signal: AbortSignal.timeout(15000),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
  const postBody = await postRes.text();
  if (postRes.ok && postBody.includes('"ok"')) ok("Signed webhook POST via tunnel");
  else fail(`Signed POST HTTP ${postRes.status}: ${postBody.slice(0, 100)}`);
}

console.log("\n--- Meta dashboard (WhatsApp > Configuration, NOT App > Webhooks) ---");
if (base) {
  console.log(`Callback URL (pick one):`);
  console.log(`  ${base}/api/webhooks/whatsapp/quotes  (recommended)`);
  console.log(`  ${base}/api/webhooks/whatsapp`);
  console.log(`  ${base}/api/webhook`);
}
console.log(`Verify token:  ${verifyToken ?? "<WHATSAPP_VERIFY_TOKEN>"}`);
console.log("Subscribe to:  messages (toggle ON)");
console.log("Then click Test next to messages — you MUST see POST in npm run dev terminal.");
console.log("Simulate locally: npm run whatsapp:simulate\n");

process.exit(failed > 0 ? 1 : 0);
