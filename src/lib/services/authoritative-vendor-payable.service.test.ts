import { describe, expect, it } from "vitest";
import {
  mergeVendorPayableWithIssuedNotes,
  snapshotFromComputedBalance,
  snapshotFromPayableRow,
} from "./authoritative-vendor-payable.service";
import { computeVendorBalance } from "../vendor-balance";

describe("authoritative vendor payable snapshots", () => {
  it("maps live balance computation into payable snapshot", () => {
    const balance = computeVendorBalance({
      vendorRate: 100000,
      advanceAmount: 40000,
      additionalCharges: 5000,
      deductions: 2000,
      tdsAmount: 2000,
    });
    const snap = snapshotFromComputedBalance({ ...balance, manualBalancePaid: 10000 });
    expect(snap).toEqual({
      freightAmount: 100000,
      additionalChargesAmount: 5000,
      deductionsAmount: 2000,
      tdsAmount: 2000,
      finalPayableAmount: 101000,
      advanceAppliedAmount: 40000,
      balanceAmount: 61000,
      balancePaidAmount: 10000,
    });
  });

  it("merges issued vendor freight reduction notes into payable snapshot", () => {
    const live = computeVendorBalance({
      vendorRate: 50000,
      advanceAmount: 30000,
      additionalCharges: 0,
      deductions: 0,
      tdsAmount: 0,
    });
    const snap = mergeVendorPayableWithIssuedNotes(
      { ...live, manualBalancePaid: 0 },
      [{ businessPurpose: "VENDOR_FREIGHT_REDUCTION", totalAmount: 2400 }]
    );
    expect(snap.deductionsAmount).toBe(2400);
    expect(snap.balanceAmount).toBe(17600);
  });

  it("merges trip charge deductions and note reductions without double-counting notes in live base", () => {
    const live = computeVendorBalance({
      vendorRate: 50000,
      advanceAmount: 30000,
      additionalCharges: 500,
      deductions: 1000,
      tdsAmount: 0,
    });
    const snap = mergeVendorPayableWithIssuedNotes(
      { ...live, manualBalancePaid: 0 },
      [{ businessPurpose: "VENDOR_FREIGHT_REDUCTION", totalAmount: 2400 }]
    );
    expect(snap.deductionsAmount).toBe(3400);
    expect(snap.additionalChargesAmount).toBe(500);
    expect(snap.balanceAmount).toBe(17100);
  });

  it("normalizes payable row decimals", () => {
    const snap = snapshotFromPayableRow({
      freightAmount: { toNumber: () => 80000 },
      additionalChargesAmount: 0,
      deductionsAmount: 0,
      tdsAmount: 0,
      finalPayableAmount: 80000,
      advanceAppliedAmount: 25000,
      balanceAmount: 55000,
      balancePaidAmount: 10000,
    });
    expect(snap.balanceAmount - snap.balancePaidAmount).toBe(45000);
    expect(snap.balanceAmount).toBe(55000);
    expect(snap.balancePaidAmount).toBe(10000);
  });
});
