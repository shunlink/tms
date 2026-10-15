import { describe, it, expect } from "vitest";
import {
  computeMargin,
  ageBucket,
  scoreMatch,
  csvEscape,
  notificationMessage,
} from "./logic";

describe("computeMargin", () => {
  it("subtracts vendor rate from client rate", () => {
    expect(computeMargin(52000, 45000)).toBe(7000);
    expect(computeMargin(45000, 52000)).toBe(-7000);
  });
});

describe("ageBucket", () => {
  it("buckets days past due", () => {
    expect(ageBucket(-5)).toBe("current");
    expect(ageBucket(0)).toBe("current");
    expect(ageBucket(1)).toBe("d30");
    expect(ageBucket(30)).toBe("d30");
    expect(ageBucket(31)).toBe("d60");
    expect(ageBucket(60)).toBe("d60");
    expect(ageBucket(61)).toBe("d90");
    expect(ageBucket(365)).toBe("d90");
  });
});

describe("scoreMatch", () => {
  const base = {
    vehicleType: "TRUCK_17FT",
    requirementType: "TRUCK_17FT",
    rating: 0,
    laneCount: 0,
    busy: false,
  };

  it("rewards an exact vehicle type match", () => {
    const { score, reasons } = scoreMatch(base);
    // exact (4) + available (2)
    expect(score).toBe(6);
    expect(reasons).toContain("Exact vehicle type");
    expect(reasons).toContain("Available now");
  });

  it("gives partial credit for a similar family", () => {
    const { score, reasons } = scoreMatch({
      ...base,
      vehicleType: "TRUCK_20FT",
      requirementType: "TRUCK_17FT",
    });
    // similar (1) + available (2)
    expect(score).toBe(3);
    expect(reasons).toContain("Similar vehicle type");
  });

  it("adds rating, lane history and penalises unavailable vehicles", () => {
    const { score, reasons } = scoreMatch({
      ...base,
      rating: 4.5,
      laneCount: 2,
      busy: true,
    });
    // exact (4) + rating (4.5) + lane (3) + busy (0)
    expect(score).toBe(11.5);
    expect(reasons).toContain("High-rated vendor (4.5★)");
    expect(reasons).toContain("Ran this lane 2x");
    expect(reasons).toContain("Currently on a trip");
  });
});

describe("csvEscape", () => {
  it("quotes values containing commas or quotes", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(123)).toBe("123");
  });
});

describe("notificationMessage", () => {
  it("returns a message for known statuses", () => {
    expect(notificationMessage("DISPATCHED")).toBe("has been dispatched");
    expect(notificationMessage("DELIVERED")).toBe("has been delivered");
  });
  it("returns null for unknown statuses", () => {
    expect(notificationMessage("PENDING")).toBeNull();
    expect(notificationMessage("WHATEVER")).toBeNull();
  });
});
