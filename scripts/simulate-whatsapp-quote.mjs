/**
 * Simulates a vendor WhatsApp reply through the public tunnel (same path Meta uses).
 * Usage: node scripts/simulate-whatsapp-quote.mjs 919021077286 50000 IND-2026-0009
 */
import crypto from "crypto";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const phone = process.argv[2] ?? "919021077286";
const amount = process.argv[3] ?? "50000";
const indent = process.argv[4] ?? "IND-2026-0009";
const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

if (!base) {
  console.error("Set PUBLIC_BASE_URL in .env");
  process.exit(1);
}

const text = amount.includes("IND-") ? amount : `quote ${indent} ${amount}`;
const msgId = `wamid.sim-${Date.now()}`;
const payload = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          value: {
            contacts: [{ profile: { name: "Vendor" }, wa_id: phone }],
            messages: [{ from: phone, id: msgId, type: "text", text: { body: text } }],
          },
          field: "messages",
        },
      ],
    },
  ],
});

const secret = process.env.WHATSAPP_APP_SECRET?.trim();
const headers = {
  "Content-Type": "application/json",
  "User-Agent": "facebookexternalhit/1.1",
};
if (secret) {
  headers["x-hub-signature-256"] =
    "sha256=" + crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

const url = `${base}/api/webhooks/whatsapp/quotes`;
console.log(`POST ${url}`);
console.log(`Body: ${text}\n`);

const res = await fetch(url, { method: "POST", headers, body: payload });
const body = await res.text();
console.log(`Status: ${res.status}`);
console.log(body);
console.log("\nCheck npm run dev terminal for [whatsapp] quote saved");
