# Juspay integration runbook

## Environment

| Variable | Required for |
|----------|----------------|
| `PAYMENT_GATEWAY_PROVIDER=juspay` | Outbound payouts |
| `JUSPAY_API_KEY` | All API calls (Basic auth username) |
| `JUSPAY_MERCHANT_ID` | `x-merchantid` header |
| `JUSPAY_PAYMENT_PAGE_CLIENT_ID` | Client portal Hypercheckout |
| `JUSPAY_API_BASE` | `https://sandbox.juspay.in` or production |
| `JUSPAY_WEBHOOK_USERNAME` / `JUSPAY_WEBHOOK_PASSWORD` | Hypercheckout webhooks |
| `JUSPAY_PAYOUT_WEBHOOK_*` | Optional separate payout webhook creds |
| `REDIS_URL` | Async outbox workers |
| `NEXT_PUBLIC_APP_URL` | Session `return_url` |

## Dashboard setup

1. **Hypercheckout:** Payments → Settings → Webhook → `https://<host>/api/webhooks/payments` + enable charge/refund events.
2. **Payout:** Configure payout webhook URL to the same endpoint (or per-order `webhookDetails`).
3. Validate sandbox beneficiary before `BENE_ID` payouts.

### Hypercheckout (client portal Pay)

- **`JUSPAY_API_KEY`** + **`JUSPAY_MERCHANT_ID`** must match **`JUSPAY_API_BASE`** (sandbox keys only on `https://sandbox.juspay.in`).
- **`JUSPAY_PAYMENT_PAGE_CLIENT_ID`** from Hypercheckout welcome mail / dashboard (not the merchant id).
- **`NEXT_PUBLIC_APP_URL`** must be a **public HTTPS** URL (Juspay rejects `http://localhost` return URLs). Use ngrok locally and restart the app after env changes.
- A **401** on `/orders` means wrong or inactive API key, or production/sandbox mismatch.
- A **403 `BAD_ORIGIN` / IP Verification Failed** on **`https://api.juspay.in`** means production **IP whitelisting**: add your server’s **public outbound IP** in Juspay dashboard (Settings → API / security). Local laptops usually are not whitelisted — use **sandbox** locally and production only from staging/production servers.
- **Restricted Mode** (new production merchants): Juspay often caps checkout at **₹9,000** per order until QA signoff. Set `JUSPAY_MAX_CHECKOUT_RUPEES=9000` so TMS returns a clear error; test with a **partial** pay amount ≤ ₹9,000.

### Local dev vs production

| Environment | `JUSPAY_API_BASE` | Keys | IP whitelist |
|---------------|-------------------|------|----------------|
| Local / dev | `https://sandbox.juspay.in` | Sandbox dashboard | Usually not required |
| Staging / prod VPS | `https://api.juspay.in` | Production dashboard | **Required** — whitelist server egress IP |


```bash
npm run worker:payment
```

Uses `tsx --tsconfig tsconfig.worker.json` so Next.js `server-only` imports resolve to a no-op stub (the npm `server-only` package throws under plain Node).

Processes outbound `PaymentOutbox` and inbound `InboundPaymentOutbox` (when Redis configured).

## Sandbox checklist

- [ ] Session creates `payment_links.web`
- [ ] Webhook returns HTTP 200 (duplicate webhooks idempotent)
- [ ] Vendor beneficiary VALID → payout Order Create
- [ ] `x-routing-id` stable per client/vendor id
- [ ] Manual Record Payment still works in parallel
