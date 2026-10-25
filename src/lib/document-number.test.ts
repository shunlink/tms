import { describe, expect, it } from "vitest";
import {
  applyYearTokens,
  defaultNumberPrefixTemplate,
  formatDocumentNumber,
  exampleDocumentNumber,
} from "./document-number";

describe("document-number", () => {
  it("formats with trailing dash prefix", () => {
    expect(formatDocumentNumber("INV-2026-", 7)).toBe("INV-2026-0007");
    expect(formatDocumentNumber(applyYearTokens("LR-{YYYY}-", 2026), 42)).toBe("LR-2026-0042");
  });

  it("substitutes year tokens in template", () => {
    expect(applyYearTokens("INV-{YYYY}-", 2026)).toBe("INV-2026-");
    expect(exampleDocumentNumber("INV-{YYYY}-", 3)).toMatch(/^INV-\d{4}-0003$/);
  });

  it("default prefixes include current year", () => {
    const y = new Date().getFullYear();
    expect(defaultNumberPrefixTemplate("INV", y)).toBe(`INV-${y}-`);
  });
});
