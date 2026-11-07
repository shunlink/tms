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

  it("allows past operational indent dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T12:00:00"));
    expect(
      indentOperationalDateFieldErrors({
        indentDate: "2026-10-20",
        pickupDate: "2026-10-20",
        podDueAt: "2026-10-01",
      })
    ).toEqual({});
  });

  it("does not enforce a date input minimum", () => {
    expect(dateInputMinForField("2026-10-20", "edit")).toBeUndefined();
    expect(dateInputMinForField("", "create")).toBeUndefined();
  });
});
