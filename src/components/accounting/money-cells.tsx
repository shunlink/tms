import { minorToRupees } from "@/lib/payments/money";

export function formatInrMinor(minor: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    minorToRupees(minor)
  );
}
