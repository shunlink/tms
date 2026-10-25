import { describe, expect, it, vi, afterEach } from "vitest";
import {
  dateInputMinForField,
  indentOperationalDateFieldErrors,
  isDateInputBeforeToday,
  localDateInputValue,
} from "./date-input";

describe("date-input", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses local calendar day for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00"));
    expect(localDateInputValue()).toBe("2026-10-24");
    expect(isDateInputBeforeToday("2026-10-23")).toBe(true);
    expect(isDateInputBeforeToday("2026-10-24")).toBe(false);
  });

  it("blocks past operational indent dates on create", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T12:00:00"));
    const errors = indentOperationalDateFieldErrors({
      indentDate: "2026-10-20",
      pickupDate: "2026-10-25",
      podDueAt: "",
    });
    expect(errors.indentDate).toMatch(/cannot be in the past/);
    expect(errors.pickupDate).toBeUndefined();
  });

  it("allows keeping an existing past date min on edit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T12:00:00"));
    expect(dateInputMinForField("2026-10-20", "edit")).toBe("2026-10-20");
    expect(dateInputMinForField("", "edit")).toBe("2026-10-24");
    expect(dateInputMinForField("", "create")).toBe("2026-10-24");
  });
});
