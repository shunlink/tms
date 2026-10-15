/** Convert INR rupees (decimal) to integer paise (minor units). */
export function rupeesToMinor(rupees: number): number {
  return Math.round(rupees * 100);
}

export function minorToRupees(minor: number): number {
  return Math.round(minor) / 100;
}

export function formatMinorINR(minor: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minorToRupees(minor));
}
