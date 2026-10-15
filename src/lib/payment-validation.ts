const ELECTRONIC_METHODS = new Set(["Bank Transfer", "NEFT", "RTGS", "UPI"]);

export function isElectronicPaymentMethod(method?: string | null): boolean {
  if (!method) return false;
  return ELECTRONIC_METHODS.has(method);
}

export function isChequePaymentMethod(method?: string | null): boolean {
  return method === "Cheque";
}

export type PaymentInput = {
  paymentMode?: string | null;
  referenceNo?: string | null;
  utrReference?: string | null;
  chequeNumber?: string | null;
  hasProof?: boolean;
};

export function validatePaymentFields(
  input: PaymentInput,
  options?: { requireProof?: boolean; referenceField?: "referenceNo" | "utrReference" }
): string | null {
  const refField = options?.referenceField ?? "referenceNo";
  const ref = refField === "utrReference" ? input.utrReference : input.referenceNo;

  if (isElectronicPaymentMethod(input.paymentMode) && !ref?.trim()) {
    return "UTR / transaction reference is required for electronic payments";
  }
  if (isChequePaymentMethod(input.paymentMode) && !input.chequeNumber?.trim()) {
    return "Cheque number is required when payment method is Cheque";
  }
  if (options?.requireProof && !input.hasProof) {
    return "Payment proof upload is required";
  }
  return null;
}
