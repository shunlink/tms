import { describe, expect, it } from "vitest";
import {
  canUploadTripPod,
  deriveTripPodQueueState,
  resolveTripPodUploadGate,
  tripPodAlreadySubmitted,
} from "./pod-upload-eligibility";

describe("canUploadTripPod", () => {
  it("allows only DELIVERED", () => {
    expect(canUploadTripPod("DELIVERED")).toBe(true);
    expect(canUploadTripPod("IN_TRANSIT")).toBe(false);
    expect(canUploadTripPod("DISPATCHED")).toBe(false);
    expect(canUploadTripPod("PENDING")).toBe(false);
  });
});

describe("tripPodAlreadySubmitted", () => {
  it("blocks when a POD is in the queue", () => {
    expect(tripPodAlreadySubmitted("PENDING_VERIFICATION")).toBe(true);
    expect(tripPodAlreadySubmitted("VERIFIED")).toBe(true);
    expect(tripPodAlreadySubmitted("BAD_POD")).toBe(true);
    expect(tripPodAlreadySubmitted(null)).toBe(false);
  });
});

describe("resolveTripPodUploadGate", () => {
  it("blocks after submission even when delivered", () => {
    const gate = resolveTripPodUploadGate("DELIVERED", "PENDING_VERIFICATION");
    expect(gate.allowed).toBe(false);
    expect(gate.message).toMatch(/already been submitted/);
  });

  it("allows first upload when delivered and no POD", () => {
    expect(resolveTripPodUploadGate("DELIVERED", null).allowed).toBe(true);
  });
});

describe("deriveTripPodQueueState", () => {
  it("prioritizes verified over pending", () => {
    expect(
      deriveTripPodQueueState([
        { status: "PENDING_VERIFICATION" },
        { status: "VERIFIED" },
      ])
    ).toBe("VERIFIED");
  });
});
