export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return "—";
  const digits = accountNumber.replace(/\s/g, "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export function maskUpi(upiId: string | null | undefined): string {
  if (!upiId) return "—";
  const at = upiId.indexOf("@");
  if (at <= 1) return "***@***";
  return `${upiId[0]}***${upiId.slice(at)}`;
}

export function buildBeneficiaryMaskedDisplay(input: {
  method: string;
  accountNumber?: string | null;
  ifsc?: string | null;
  upiId?: string | null;
  accountHolder?: string | null;
}): string {
  if (input.method === "UPI" && input.upiId) {
    return `UPI ${maskUpi(input.upiId)}`;
  }
  const acct = maskAccountNumber(input.accountNumber);
  const ifsc = input.ifsc ? ` · ${input.ifsc}` : "";
  const holder = input.accountHolder ? `${input.accountHolder} · ` : "";
  return `${holder}${acct}${ifsc}`;
}

export function sanitizeBeneficiaryForClient<T extends {
  accountNumber?: string | null;
  ifsc?: string | null;
  upiId?: string | null;
  maskedDisplay: string;
}>(row: T) {
  const { accountNumber: _a, ifsc: _i, upiId: _u, ...rest } = row;
  return rest;
}
