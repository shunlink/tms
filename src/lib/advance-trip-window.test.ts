import { describe, expect, it } from "vitest";
import {
  ADVANCE_WINDOW_CLOSED_MESSAGE,
  assertTripAdvanceWindowOpen,
  isTripStatusInAdvanceWindow,
} from "./advance-trip-window";

describe("advance-trip-window", () => {
  it("allows pending, dispatched, and in transit", () => {
    expect(isTripStatusInAdvanceWindow("PENDING")).toBe(true);
    expect(isTripStatusInAdvanceWindow("DISPATCHED")).toBe(true);
    expect(isTripStatusInAdvanceWindow("IN_TRANSIT")).toBe(true);
  });

  it("closes at delivered and later statuses", () => {
    expect(isTripStatusInAdvanceWindow("DELIVERED")).toBe(false);
    expect(isTripStatusInAdvanceWindow("CLOSED")).toBe(false);
    expect(() => assertTripAdvanceWindowOpen("DELIVERED")).toThrow(ADVANCE_WINDOW_CLOSED_MESSAGE);
  });
});
