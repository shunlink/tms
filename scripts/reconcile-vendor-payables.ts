/**
 * Phase 1 reconciliation: compare authoritative VendorTripPayable, balance tasks, and live trip math.
 *
 * Usage: npx tsx scripts/reconcile-vendor-payables.ts [--fix]
 * --fix re-runs syncVendorTripPayableFromTrip for trips with PAYABLE_VS_TASK_PAID only (safe backfill).
 */
import {
  reconcileAllVendorTripPayables,
  syncVendorTripPayableFromTrip,
} from "../src/lib/services/authoritative-vendor-payable.service";
import { syncVendorPaymentLedger } from "../src/lib/services/vendor-payment.service";

async function main() {
  const fix = process.argv.includes("--fix");

  const ledgerCreated = await syncVendorPaymentLedger();
  console.log(`VendorPayment ledger sync: ${ledgerCreated} new row(s)`);

  const issues = await reconcileAllVendorTripPayables(2000);
  if (issues.length === 0) {
    console.log("No payable discrepancies found.");
    return;
  }

  console.log(`Found ${issues.length} discrepancy(ies):`);
  for (const issue of issues) {
    console.log(
      `- [${issue.kind}] trip ${issue.tripId}${issue.lrNumber ? ` (${issue.lrNumber})` : ""}: ${issue.message}` +
        (issue.expected != null ? ` expected=${issue.expected} actual=${issue.actual}` : "")
    );
  }

  if (fix) {
    const paidMismatches = issues.filter((i) => i.kind === "PAYABLE_VS_TASK_PAID");
    for (const issue of paidMismatches) {
      await syncVendorTripPayableFromTrip(issue.tripId, {
        adjustmentType: "BACKFILL",
        reason: "Reconciliation script — align payable paid amount with task",
        recordAdjustment: false,
      });
      console.log(`Fixed payable paid amount for trip ${issue.tripId}`);
    }
  } else if (issues.some((i) => i.kind === "PAYABLE_VS_TASK_PAID")) {
    console.log("Run with --fix to align payable.balancePaidAmount with balance tasks (safe).");
  }

  process.exit(issues.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
