import { describe, expect, it } from "vitest";
import { buildStableRowKey, parseBankStatementCsv, sha256Hex } from "./bank-statement-csv";
import { DEFAULT_BANK_CSV_MAPPING } from "./bank-statement-types";

describe("bank statement CSV", () => {
  it("parses valid debit/credit rows", () => {
    const csv = `Date,Narration,Reference,Debit,Credit,Balance
2025-01-15,Vendor payment,UTR123,0,5000.00,100000.00
2025-01-16,NEFT receipt,UTR456,2500.00,0,102500.00`;
    const result = parseBankStatementCsv(csv, DEFAULT_BANK_CSV_MAPPING, {
      defaultCurrency: "INR",
      glAccountCode: "1010",
    });
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].direction).toBe("CREDIT");
    expect(result.rows[0].amountMinor).toBe(500000);
    expect(result.rows[1].direction).toBe("DEBIT");
  });

  it("rejects missing date column", () => {
    const csv = `Foo,Debit,Credit
x,100,0`;
    const result = parseBankStatementCsv(csv, DEFAULT_BANK_CSV_MAPPING, {
      defaultCurrency: "INR",
      glAccountCode: "1010",
    });
    expect(result.rows).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("uses external line id for stable key when present", () => {
    const key = buildStableRowKey({
      glAccountCode: "1010",
      externalLineId: "BANK-99",
      externalReference: null,
      transactionDate: new Date("2025-01-01T00:00:00.000Z"),
      direction: "DEBIT",
      amountMinor: 100,
      currency: "INR",
      lineNumber: 1,
    });
    expect(key).toContain("ext:BANK-99");
  });

  it("hashes file content", () => {
    expect(sha256Hex("test")).toHaveLength(64);
  });
});
