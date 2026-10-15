/** Statuses in which a released indent is open for vendor quoting (not yet allocated). */
export const VENDOR_QUOTE_STATUSES = ["RELEASED_TO_VENDORS", "QUOTING"] as const;

export function isIndentOpenForVendorQuoting(indent: {
  status: string;
  vendorId?: string | null;
}) {
  return (
    VENDOR_QUOTE_STATUSES.includes(indent.status as (typeof VENDOR_QUOTE_STATUSES)[number]) &&
    !indent.vendorId
  );
}
