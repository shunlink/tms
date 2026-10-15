/**
 * Starts ngrok and prints the webhook URLs to paste into Meta.
 * Run: npm run tunnel
 */
import { spawn } from "child_process";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const expected = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

console.log("\nStarting ngrok on port 3000...");
console.log("Keep this terminal open while testing WhatsApp replies.\n");

if (expected) {
  console.log(`Expected URL in .env: ${expected}`);
  console.log("If ngrok shows a different URL, update PUBLIC_BASE_URL and re-verify Meta webhook.\n");
}

const child = spawn("ngrok", ["http", "3000", "--log=stdout"], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  if (code !== 0) {
    console.error(`\n[ngrok] exited with code ${code}. Run: ngrok config add-authtoken <token>`);
  }
  process.exit(code ?? 1);
});

// After ngrok starts, print webhook URLs once tunnel is up.
setTimeout(async () => {
  try {
    const res = await fetch("http://127.0.0.1:4040/api/tunnels", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const data = await res.json();
    const url = data.tunnels?.find((t) => t.public_url?.startsWith("https://"))?.public_url?.replace(/\/+$/, "");
    if (!url) return;
    console.log("\n--- Paste ONE of these in Meta WhatsApp > Configuration > Webhook ---");
    console.log(`  ${url}/api/webhooks/whatsapp/quotes  (recommended)`);
    console.log(`  ${url}/api/webhooks/whatsapp`);
    console.log(`  ${url}/api/webhook`);
    console.log(`Verify token: ${process.env.WHATSAPP_VERIFY_TOKEN ?? "(set WHATSAPP_VERIFY_TOKEN)"}`);
    console.log("Subscribe to field: messages\n");
  } catch {
    // ngrok still starting
  }
}, 4000);
