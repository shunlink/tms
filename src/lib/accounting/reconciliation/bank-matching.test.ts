import { describe, expect, it } from "vitest";
import { canAutoConfirmMatch, suggestBankMatches } from "./bank-matching";

describe("bank matching", () => {
  it("confirms exact reference matches only when unambiguous", () => {
    const suggestions = suggestBankMatches(
      [
        {
          stableRowKey: "s1",
          amountMinor: 10000,
          currency: "INR",
          direction: "CREDIT",
          transactionDate: new Date("2025-02-01T00:00:00.000Z"),
          externalReference: "UTR-ABC",
          description: null,
        },
      ],
      [
        {
          id: "i1",
          kind: "OUTBOUND_PAYMENT",
          amountMinor: 10000,
          currency: "INR",
          direction: "CREDIT",
          transactionDate: new Date("2025-02-01T00:00:00.000Z"),
          reference: "UTR-ABC",
          description: null,
          outboundPaymentId: "pay1",
        },
      ]
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].matchingMethod).toBe("EXACT_REFERENCE");
    expect(canAutoConfirmMatch(suggestions[0])).toBe(true);
  });

  it("marks ambiguous amount/date matches", () => {
    const suggestions = suggestBankMatches(
      [
        {
          stableRowKey: "s1",
          amountMinor: 5000,
          currency: "INR",
          direction: "DEBIT",
          transactionDate: new Date("2025-02-01T00:00:00.000Z"),
          externalReference: null,
          description: null,
        },
      ],
      [
        {
          id: "a",
          kind: "JOURNAL_LINE",
          amountMinor: 5000,
          currency: "INR",
          direction: "DEBIT",
          transactionDate: new Date("2025-02-01T00:00:00.000Z"),
          reference: null,
          description: null,
        },
        {
          id: "b",
          kind: "JOURNAL_LINE",
          amountMinor: 5000,
          currency: "INR",
          direction: "DEBIT",
          transactionDate: new Date("2025-02-01T00:00:00.000Z"),
          reference: null,
          description: null,
        },
      ]
    );
    expect(suggestions[0].ambiguous).toBe(true);
    expect(canAutoConfirmMatch(suggestions[0])).toBe(false);
  });
});
