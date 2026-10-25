export const BUSINESS_TYPE_VALUES = [
  "PRIVATE_LIMITED",
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "PUBLIC_LIMITED",
  "OTHER",
] as const;

export type BusinessType = (typeof BUSINESS_TYPE_VALUES)[number];

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "PRIVATE_LIMITED", label: "Private Limited" },
  { value: "PROPRIETORSHIP", label: "Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "LLP", label: "LLP" },
  { value: "PUBLIC_LIMITED", label: "Public Limited" },
  { value: "OTHER", label: "Other" },
];

export function businessTypeLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const found = BUSINESS_TYPE_OPTIONS.find((o) => o.value === code);
  return found?.label ?? code;
}
