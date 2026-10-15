import { describe, it, expect } from "vitest";
import { formatPendingCount } from "./sidebar-pending-keys";

describe("formatPendingCount", () => {
  it("returns empty string for zero or negative", () => {
    expect(formatPendingCount(0)).toBe("");
    expect(formatPendingCount(-1)).toBe("");
  });

  it("returns count as string for normal values", () => {
    expect(formatPendingCount(3)).toBe("3");
    expect(formatPendingCount(99)).toBe("99");
  });

  it("caps at 99+", () => {
    expect(formatPendingCount(100)).toBe("99+");
    expect(formatPendingCount(500)).toBe("99+");
  });
});
