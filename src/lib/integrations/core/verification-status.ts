export type IntegrationVerificationMode = "MOCK" | "LIVE";

export type VerificationStatus =
  | "MOCK"
  | "VERIFIED"
  | "FAILED"
  | "NOT_VERIFIED"
  | "PENDING";

export function isSuccessfulVerification(status: string | null | undefined): boolean {
  return status === "VERIFIED" || status === "MOCK";
}

export function isMockVerification(status: string | null | undefined): boolean {
  return status === "MOCK";
}

export function countsAsVerified(status: string | null | undefined): boolean {
  return isSuccessfulVerification(status);
}

export function markMockVerification<T extends Record<string, unknown>>(
  data: T
): T & { verificationStatus: "MOCK"; verificationMode: "MOCK" } {
  return {
    ...data,
    verificationStatus: "MOCK",
    verificationMode: "MOCK",
  };
}
