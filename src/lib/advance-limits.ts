import { MAX_ADVANCE_PERCENT_OF_FREIGHT } from "./constants";

type FreightAmount = number | null | undefined | { toString(): string };

function toFreightNumber(vendorRate: FreightAmount): number {
  if (vendorRate == null) return 0;
  return typeof vendorRate === "number" ? vendorRate : Number(vendorRate);
}

/** Max advance amount vendor may request — 85% of their quoted trip freight (vendorRate). */
export function maxAdvanceForVendorRate(vendorRate: FreightAmount): number {
  const rate = toFreightNumber(vendorRate);
  if (rate <= 0) return 0;
  return Math.round(rate * MAX_ADVANCE_PERCENT_OF_FREIGHT);
}

export function advanceCapErrorMessage(vendorRate: FreightAmount): string {
  const rate = toFreightNumber(vendorRate);
  const max = maxAdvanceForVendorRate(rate);
  return `Advance cannot exceed 85% of your trip freight. Please enter ₹${max.toLocaleString("en-IN")} or less.`;
}

/** Throws when amount exceeds 85% of vendor freight. */
export function assertAdvanceWithinFreightCap(
  amount: number,
  vendorRate: FreightAmount
): void {
  const rate = toFreightNumber(vendorRate);
  if (rate <= 0) return;
  const max = maxAdvanceForVendorRate(rate);
  if (amount > max) {
    throw new Error(advanceCapErrorMessage(rate));
  }
}
