import { describe, expect, it } from "vitest";
import { ifscSchema, isValidIfsc } from "./field-validators";

describe("IFSC validation", () => {
  it("accepts valid IFSC", () => {
    expect(isValidIfsc("HDFC0001234")).toBe(true);
    const parsed = ifscSchema.safeParse("hdfc 0001234");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("HDFC0001234");
  });

  it("rejects invalid IFSC", () => {
    expect(isValidIfsc("HDFC001234")).toBe(false);
    expect(ifscSchema.safeParse("").success).toBe(false);
  });
});
