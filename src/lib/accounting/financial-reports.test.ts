import { describe, expect, it } from "vitest";
import { presentBalanceMinor, rowsFromAggregates } from "./gl-balances.service";

describe("GL balance presentation", () => {
  it("shows debit-normal asset balance on debit side", () => {
    const p = presentBalanceMinor(10000, 3000, "DEBIT");
    expect(p.netDebitMinor).toBe(7000);
    expect(p.netCreditMinor).toBe(0);
    expect(p.signedBalanceMinor).toBe(7000);
  });

  it("shows credit-normal liability balance on credit side", () => {
    const p = presentBalanceMinor(2000, 9000, "CREDIT");
    expect(p.netDebitMinor).toBe(0);
    expect(p.netCreditMinor).toBe(7000);
    expect(p.signedBalanceMinor).toBe(7000);
  });

  it("excludes zero-activity accounts by default", () => {
    const rows = rowsFromAggregates([
      {
        accountId: "1",
        code: "1010",
        name: "Bank",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        parentId: null,
        parentCode: null,
        debitMinor: 0,
        creditMinor: 0,
      },
      {
        accountId: "2",
        code: "2110",
        name: "Payables",
        accountType: "LIABILITY",
        normalBalance: "CREDIT",
        parentId: null,
        parentCode: null,
        debitMinor: 100,
        creditMinor: 500,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].accountCode).toBe("2110");
  });

  it("flags trial-balance-style imbalance from raw debit/credit totals", () => {
    const rows = rowsFromAggregates([
      {
        accountId: "1",
        code: "1010",
        name: "Bank",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        parentId: null,
        parentCode: null,
        debitMinor: 1000,
        creditMinor: 0,
      },
      {
        accountId: "2",
        code: "2110",
        name: "Payables",
        accountType: "LIABILITY",
        normalBalance: "CREDIT",
        parentId: null,
        parentCode: null,
        debitMinor: 0,
        creditMinor: 900,
      },
    ]);
    const debits = rows.reduce((s, r) => s + r.totalDebitMinor, 0);
    const credits = rows.reduce((s, r) => s + r.totalCreditMinor, 0);
    expect(debits - credits).toBe(100);
  });
});
