import type { AccountType } from "./types";
import { normalBalanceForAccountType } from "./types";

export type StarterAccountDef = {
  code: string;
  name: string;
  accountType: AccountType;
  parentCode?: string;
  isSystem?: boolean;
  manualPostingAllowed?: boolean;
  isActive?: boolean;
  description?: string;
};

/**
 * Finance-configurable starter chart for TMS workflows.
 * Not a claim of statutory completeness — tax control accounts ship inactive until enabled.
 */
export const STARTER_CHART_OF_ACCOUNTS: StarterAccountDef[] = [
  { code: "1000", name: "Assets", accountType: "ASSET", isSystem: true, manualPostingAllowed: false },
  { code: "1010", name: "Bank / Cash", accountType: "ASSET", parentCode: "1000", isSystem: true },
  { code: "1015", name: "Gateway Clearing", accountType: "ASSET", parentCode: "1000", isSystem: true },
  { code: "1200", name: "Accounts Receivable Control", accountType: "ASSET", parentCode: "1000", isSystem: true },

  { code: "2000", name: "Liabilities", accountType: "LIABILITY", isSystem: true, manualPostingAllowed: false },
  {
    code: "2100",
    name: "Vendor Payable Control",
    accountType: "LIABILITY",
    parentCode: "2000",
    isSystem: true,
  },
  {
    code: "2110",
    name: "Vendor Payables",
    accountType: "LIABILITY",
    parentCode: "2100",
    isSystem: true,
    description: "Subledger control for vendor trip payables",
  },
  { code: "2150", name: "Vendor Advances", accountType: "LIABILITY", parentCode: "2000", isSystem: true },
  {
    code: "2200",
    name: "Tax Control (configure before use)",
    accountType: "LIABILITY",
    parentCode: "2000",
    isSystem: true,
    isActive: false,
    manualPostingAllowed: false,
    description: "Enable only after finance approves tax account mapping",
  },

  { code: "3000", name: "Equity", accountType: "EQUITY", isSystem: true, manualPostingAllowed: false },
  {
    code: "3100",
    name: "Opening Balance Equity",
    accountType: "EQUITY",
    parentCode: "3000",
    isSystem: true,
    manualPostingAllowed: false,
  },
  {
    code: "3200",
    name: "Retained Earnings",
    accountType: "EQUITY",
    parentCode: "3000",
    isSystem: true,
    manualPostingAllowed: false,
  },

  { code: "4000", name: "Revenue", accountType: "REVENUE", isSystem: true, manualPostingAllowed: false },
  {
    code: "4100",
    name: "Freight Revenue",
    accountType: "REVENUE",
    parentCode: "4000",
    isSystem: true,
  },
  {
    code: "4150",
    name: "Revenue Adjustments (configure before use)",
    accountType: "REVENUE",
    parentCode: "4000",
    isSystem: true,
    description: "Client billing reductions — enable after finance approval",
  },

  { code: "5000", name: "Expenses", accountType: "EXPENSE", isSystem: true, manualPostingAllowed: false },
  {
    code: "5100",
    name: "Vendor Freight Expense",
    accountType: "EXPENSE",
    parentCode: "5000",
    isSystem: true,
  },
  {
    code: "5900",
    name: "Other Operating Expense",
    accountType: "EXPENSE",
    parentCode: "5000",
    isSystem: true,
  },
];

/** Legacy gateway LedgerEntry.account string → chart code */
export const LEGACY_LEDGER_ACCOUNT_MAP: Record<string, string> = {
  VENDOR_PAYABLE: "2110",
  VENDOR_ADVANCE: "2150",
  BANK_CLEARING: "1015",
};

export function starterAccountRow(def: StarterAccountDef) {
  return {
    code: def.code,
    name: def.name,
    accountType: def.accountType,
    normalBalance: normalBalanceForAccountType(def.accountType),
    isSystem: def.isSystem ?? false,
    manualPostingAllowed: def.manualPostingAllowed ?? !def.isSystem,
    isActive: def.isActive ?? true,
    description: def.description ?? null,
  };
}
