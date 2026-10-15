# Payment gateway adapters

Add a new provider under `src/lib/payments/gateway/providers/<name>.ts` implementing `PaymentGateway` from `interface.ts`.

1. Register the provider id in `config.ts` (`PaymentProviderId`).
2. Wire it in `registry.ts` (never enable mock in production).
3. Add webhook secret env `PAYMENT_WEBHOOK_SECRET_<PROVIDER>` or shared `PAYMENT_WEBHOOK_SECRET`.
4. Document provider onboarding, KYC, and transfer limits in your runbook.

Keep all provider-specific HTTP, auth, and error codes inside the adapter.
