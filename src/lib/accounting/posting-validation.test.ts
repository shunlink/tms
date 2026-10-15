import { describe, expect, it } from "vitest";
import {
  assertBalancedJournal,
  buildResolvedLines,
  PostingValidationError,
  reversalLinesFromPosted,
  validateLineAmounts,
} from "./posting-validation";

const accounts = new Map([
  [
    "1010",
    { id: "a1", code: "1010", isActive: true, manualPostingAllowed: true, isSystem: false },
  ],
  [
    "2110",
    { id: "a2", code: "2110", isActive: true, manualPostingAllowed: true, isSystem: true },
  ],
  [
    "5900",
    { id: "a3", code: "5900", isActive: false, manualPostingAllowed: true, isSystem: false },
  ],
]);

describe("posting validation", () => {
  it("rejects negative amounts", () => {
    expect(() => validateLineAmounts({ debitMinor: -1, creditMinor: 0 })).toThrow(PostingValidationError);
  });

  it("rejects both debit and credit on one line", () => {
    expect(() => validateLineAmounts({ debitMinor: 100, creditMinor: 50 })).toThrow(PostingValidationError);
  });

  it("rejects unbalanced journals", () => {
    expect(() =>
      assertBalancedJournal([
        { debitMinor: 100, creditMinor: 0 },
        { debitMinor: 0, creditMinor: 50 },
      ])
    ).toThrow(/not balanced/);
  });

  it("accepts balanced journals", () => {
    assertBalancedJournal([
      { debitMinor: 1000, creditMinor: 0 },
      { debitMinor: 0, creditMinor: 1000 },
    ]);
  });

  it("rejects inactive accounts", () => {
    expect(() =>
      buildResolvedLines(
        [
          { accountCode: "5900", debitMinor: 100, creditMinor: 0 },
          { accountCode: "1010", debitMinor: 0, creditMinor: 100 },
        ],
        accounts,
        "INR",
        { manualJournal: true }
      )
    ).toThrow(/inactive/);
  });

  it("builds reversal lines by swapping sides", () => {
    const rev = reversalLinesFromPosted([
      { accountCode: "2110", debitMinor: 500, creditMinor: 0 },
      { accountCode: "1015", debitMinor: 0, creditMinor: 500 },
    ]);
    expect(rev[0]).toMatchObject({ accountCode: "2110", debitMinor: 0, creditMinor: 500 });
    expect(rev[1]).toMatchObject({ accountCode: "1015", debitMinor: 500, creditMinor: 0 });
  });
});
