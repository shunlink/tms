export const VENDOR_PAYMENT_TERMS_TYPE_VALUES = ["CREDIT", "ADHOC"] as const;

export type VendorPaymentTermsType = (typeof VENDOR_PAYMENT_TERMS_TYPE_VALUES)[number];

export const VENDOR_PAYMENT_TERMS_TYPE_OPTIONS: {
  value: VendorPaymentTermsType;
  label: string;
}[] = [
  { value: "CREDIT", label: "Credit" },
  { value: "ADHOC", label: "Adhoc" },
];

export function formatVendorPaymentTermsType(value: string | null | undefined): string | null {
  if (!value) return null;
  const opt = VENDOR_PAYMENT_TERMS_TYPE_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? value;
}
