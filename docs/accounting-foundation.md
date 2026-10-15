# ShunLink TMS — Accounting Foundation (Phase 2)

## Design summary

### Models

| Model | Role |
|--------|------|
| `ChartOfAccount` | Stable codes, typed classification (`ASSET` … `EXPENSE`), hierarchy, system/manual flags |
| `AccountingPeriod` | Date-bounded `OPEN` / `CLOSED` posting control |
| `JournalEntry` | Header with `idempotencyKey`, source document, lifecycle `DRAFT` → `POSTED` → `REVERSED` |
| `JournalLine` | Debit/credit in **minor units** (paise), FK to COA, optional subledger refs |

`LedgerEntry` (Phase 1 gateway mirror) is **bridged**, not replaced: successful outbound payments post one `JournalEntry` and mirror two legacy rows linked via `journalEntryId` / `journalLineId`.

### Account typing

Normal balance is stored explicitly (`DEBIT` for assets/expenses, `CREDIT` for liabilities/equity/revenue). Reporting must use `accountType`, not account names.

Starter chart lives in `src/lib/accounting/starter-chart.ts` and is applied idempotently by `ensureChartOfAccounts()`.

### Journal lifecycle & invariants

- Draft journals may be created (manual API) with validated lines.
- **Post** only when: ≥2 lines, non-negative amounts, exactly one side per line, debits = credits, accounts active, period open, idempotency unique.
- Posted journals are not updated in place; use `reversePostedJournal` (linked reversal entry).
- Multi-currency: single currency per journal header/lines in this phase (INR default).

### Posting rules (now vs later)

| Now | Later phases |
|-----|----------------|
| `OUTBOUND_PAYMENT` settlement (Dr 2110 / Cr 1015) | Client receipts, invoices, vendor advances, notes |
| Manual draft/post via API | UI manual journal composer |
| Period open/close/reopen | Period-end close, retained earnings automation |

### Legacy compatibility

- `postPaymentLedger` → `postOutboundPaymentJournal` (single path).
- `ledgerPostedAt` on `OutboundPayment` still gates duplicate gateway posting.
- `auditLegacyPaymentLedger()` flags missing journal bridge, unbalanced legacy pairs, unknown account strings — **no auto-fix or opening balances**.

## Deployment order

1. Backup database.
2. `npm run db:migrate:deploy` (applies `20261009180000_accounting_foundation`).
3. `npx tsx scripts/init-accounting.ts` **or** `npm run db:seed` on non-prod — runs `ensureChartOfAccounts` + `ensureDefaultAccountingPeriods`.
4. `npm run db:generate` on app servers if not part of build.
5. Deploy application build.

### Rollback

- Do **not** drop accounting tables if journals were posted (audit trail).
- Roll back app only if migration not applied; if migration applied, forward-fix preferred.
- Re-open closed periods only via `accounting.period.reopen` with audited reason.

## Commands

```bash
npm run db:generate
npm run db:migrate:deploy   # production
npm run accounting:init     # chart + FY period
npm test
npm run typecheck
npm run build
```

## Finance decisions still needed

- Enable/configure tax control account `2200` and GST mapping.
- Approved cutover date and verified balances before any opening-balance journals.
- Whether manual journals require approver before post (schema supports `approvedById`; workflow TBD).
