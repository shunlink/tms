/** System control account codes — finance configures mapping in chart of accounts. */
export const CONTROL_ACCOUNT_CODES = {
  ACCOUNTS_RECEIVABLE: "1200",
  BANK_CASH: "1010",
  GATEWAY_CLEARING: "1015",
  VENDOR_PAYABLE_CONTROL: "2100",
  VENDOR_PAYABLES: "2110",
  VENDOR_ADVANCES: "2150",
  RETAINED_EARNINGS: "3200",
  OPENING_BALANCE_EQUITY: "3100",
} as const;

export type ControlAccountCode = (typeof CONTROL_ACCOUNT_CODES)[keyof typeof CONTROL_ACCOUNT_CODES];
