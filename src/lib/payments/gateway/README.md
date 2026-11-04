# Payment gateway adapters

Add a new provider under `src/lib/payments/gateway/providers/<name>.ts` implementing `PaymentGateway` from `interface.ts`.

1. Register the provider id in `config.ts` (`PaymentProviderId`).
2. Wire it in `registry.ts` (never enable mock in production).
3. Juspay webhooks use **Basic Auth** (`JUSPAY_WEBHOOK_USERNAME` / `JUSPAY_WEBHOOK_PASSWORD`), not HMAC.
4. See `src/lib/payments/juspay/RUNBOOK.md` for Hypercheckout + Payout setup.

Keep all provider-specific HTTP, auth, and error codes inside the adapter.
