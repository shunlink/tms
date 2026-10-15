# Payment processing module

## Overview

Gateway-bound vendor transfers are modeled as `OutboundPayment` records with execution attempts, ledger entries, and outbox jobs. Manual finance recordings (`VendorPayment`, `VendorBalancePayment`, advance completion with proof) remain separate and are never treated as bank transfers.

## Flow

1. Finance creates a draft (`POST /api/outbound-payments`) linked to an advance request or balance task.
2. Submit for approval → approver (different user) approves (`POST .../approve`).
3. Execute (`POST .../execute`) enqueues `PaymentOutbox` → worker or inline processor calls the gateway adapter.
4. On verified success: journal posted once (`ledgerPostedAt`), then `settleOutboundPaymentSuccess` updates advance/balance TMS records (`financeSettledAt` idempotency). Outbox drain retries pending finance settlement.

## Operations

- `npm run worker:payment` with `REDIS_URL` (optional; falls back to inline outbox processing).
- Webhook route: `POST /api/webhooks/payments` (provider-specific signature in adapter).
- Reconciliation: `POST /api/reconciliation/payments`.

## Adding a provider

See `src/lib/payments/gateway/README.md`.
