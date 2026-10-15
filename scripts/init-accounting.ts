import { ensureChartOfAccounts } from "../src/lib/accounting/chart-of-accounts.service";
import { ensureDefaultAccountingPeriods } from "../src/lib/accounting/accounting-period.service";
import { auditLegacyPaymentLedger } from "../src/lib/accounting/legacy-ledger-audit";

async function main() {
  console.log("Initializing chart of accounts...");
  const accounts = await ensureChartOfAccounts();
  console.log(`Chart: ${accounts.length} accounts`);

  console.log("Ensuring default accounting period...");
  const period = await ensureDefaultAccountingPeriods();
  console.log(`Period: ${period.name} (${period.status})`);

  console.log("Scanning legacy gateway ledger (read-only)...");
  const audit = await auditLegacyPaymentLedger(200);
  console.log(`Scanned ${audit.scannedPayments} payments; ${audit.issues.length} issue(s)`);
  for (const i of audit.issues.slice(0, 20)) {
    console.log(`  - ${i.paymentId}: ${i.issue}${i.detail ? ` (${i.detail})` : ""}`);
  }
  if (audit.issues.length > 20) {
    console.log(`  ... and ${audit.issues.length - 20} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
