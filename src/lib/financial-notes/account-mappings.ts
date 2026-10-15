import type { BusinessPurpose } from "./types";

/** Finance-configurable GL mapping per business purpose (not universal DN/CN direction). */
export type NoteAccountMapping = {
  debitAccountCode: string;
  creditAccountCode: string;
  description: string;
};

const VENDOR_PAYABLE = "2110";
const VENDOR_FREIGHT_EXPENSE = "5100";
const VENDOR_OTHER_EXPENSE = "5900";
const AR_CONTROL = "1200";
const FREIGHT_REVENUE = "4100";
const REVENUE_ADJUSTMENT = "4150";

export const NOTE_ACCOUNT_MAPPINGS: Record<BusinessPurpose, NoteAccountMapping> = {
  VENDOR_FREIGHT_INCREASE: {
    debitAccountCode: VENDOR_FREIGHT_EXPENSE,
    creditAccountCode: VENDOR_PAYABLE,
    description: "Vendor freight increase — expense and payable",
  },
  VENDOR_FREIGHT_REDUCTION: {
    debitAccountCode: VENDOR_PAYABLE,
    creditAccountCode: VENDOR_OTHER_EXPENSE,
    description: "Vendor freight reduction — payable and adjustment",
  },
  CLIENT_BILLING_INCREASE: {
    debitAccountCode: AR_CONTROL,
    creditAccountCode: FREIGHT_REVENUE,
    description: "Client billing increase — receivable and revenue",
  },
  CLIENT_BILLING_REDUCTION: {
    debitAccountCode: REVENUE_ADJUSTMENT,
    creditAccountCode: AR_CONTROL,
    description: "Client billing reduction — revenue adjustment and receivable",
  },
  OTHER: {
    debitAccountCode: VENDOR_OTHER_EXPENSE,
    creditAccountCode: VENDOR_PAYABLE,
    description: "Other adjustment — finance must validate purpose before issuance",
  },
};

export function resolveMappingForPurpose(purpose: string): NoteAccountMapping {
  const key = purpose as BusinessPurpose;
  const mapping = NOTE_ACCOUNT_MAPPINGS[key];
  if (!mapping) throw new Error(`Unknown business purpose: ${purpose}`);
  return mapping;
}
