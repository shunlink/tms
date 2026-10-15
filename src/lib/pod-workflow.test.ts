import { describe, it, expect } from "vitest";
import {
  POD_STATUSES,
  POD_TRANSITIONS,
  canPodTransition,
  assertPodTransition,
  isPodPendingVerification,
  isBadPod,
  isBadPodUnresolved,
  isBadPodSlaBreached,
} from "./pod-states";
import { POD_SOURCES, POD_SLA_MS, POD_SLA_HOURS } from "./constants";
import { DEFAULT_ROLE_PERMISSIONS } from "./permissions";

/** Simulates the acceptance workflow using pure state transitions. */
type SimPod = {
  id: string;
  status: string;
  resolutionStatus: string | null;
  rejectionReason: string | null;
  previousPodId: string | null;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  slaDeadlineAt: Date | null;
  escalatedAt: Date | null;
};

function simUpload(id: string): SimPod {
  return {
    id,
    status: "PENDING_VERIFICATION",
    resolutionStatus: null,
    rejectionReason: null,
    previousPodId: null,
    verifiedAt: null,
    rejectedAt: null,
    slaDeadlineAt: null,
    escalatedAt: null,
  };
}

function simReject(pod: SimPod, reason: string, now: Date): SimPod {
  assertPodTransition(pod.status, "BAD_POD");
  const slaDeadlineAt = new Date(now.getTime() + POD_SLA_MS);
  return {
    ...pod,
    status: "BAD_POD",
    rejectionReason: reason,
    rejectedAt: now,
    resolutionStatus: "PENDING",
    slaDeadlineAt,
  };
}

function simCorrect(pod: SimPod, newId: string): { badPod: SimPod; newPod: SimPod } {
  const badPod = { ...pod, resolutionStatus: "CORRECTED" };
  const newPod: SimPod = {
    ...simUpload(newId),
    previousPodId: pod.id,
  };
  return { badPod, newPod };
}

function simVerify(pod: SimPod, now: Date): SimPod {
  assertPodTransition(pod.status, "VERIFIED");
  return { ...pod, status: "VERIFIED", verifiedAt: now };
}

function simEscalate(pod: SimPod, now: Date): SimPod | null {
  if (!isBadPodUnresolved(pod.status, pod.resolutionStatus)) return null;
  if (!pod.slaDeadlineAt || pod.slaDeadlineAt >= now) return null;
  if (pod.escalatedAt) return null;
  return {
    ...pod,
    resolutionStatus: "SLA_BREACHED",
    escalatedAt: now,
  };
}

describe("POD status constants", () => {
  it("defines the verification lifecycle statuses", () => {
    expect(POD_STATUSES).toEqual(["INCOMPLETE", "PENDING_VERIFICATION", "VERIFIED", "BAD_POD"]);
  });

  it("supports DRIVER, EMPLOYEE, and VENDOR upload sources", () => {
    expect(POD_SOURCES).toEqual(["DRIVER", "EMPLOYEE", "VENDOR"]);
  });

  it("uses a 24-hour bad POD resolution SLA", () => {
    expect(POD_SLA_HOURS).toBe(24);
    expect(POD_SLA_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("POD state machine", () => {
  it("allows PENDING_VERIFICATION → VERIFIED or BAD_POD", () => {
    expect(canPodTransition("PENDING_VERIFICATION", "VERIFIED")).toBe(true);
    expect(canPodTransition("PENDING_VERIFICATION", "BAD_POD")).toBe(true);
    expect(canPodTransition("PENDING_VERIFICATION", "PENDING_VERIFICATION")).toBe(false);
  });

  it("does not allow transitions from terminal states", () => {
    expect(POD_TRANSITIONS.VERIFIED).toEqual([]);
    expect(POD_TRANSITIONS.BAD_POD).toEqual([]);
    expect(canPodTransition("VERIFIED", "BAD_POD")).toBe(false);
  });

  it("rejects illegal transitions", () => {
    expect(() => assertPodTransition("VERIFIED", "BAD_POD")).toThrow(/Invalid POD transition/);
  });

  it("identifies pending verification and bad POD states", () => {
    expect(isPodPendingVerification("PENDING_VERIFICATION")).toBe(true);
    expect(isBadPod("BAD_POD")).toBe(true);
    expect(isBadPodUnresolved("BAD_POD", "PENDING")).toBe(true);
    expect(isBadPodSlaBreached("SLA_BREACHED")).toBe(true);
  });
});

describe("Acceptance: vendor upload → verify workflow", () => {
  it("vendor uploads POD → operations sees pending → rejects → bad POD task → corrects → verified", () => {
    const t0 = new Date("2026-10-01T10:00:00Z");

    // 1. Vendor uploads POD
    const uploaded = simUpload("pod-1");
    expect(uploaded.status).toBe("PENDING_VERIFICATION");
    expect(isPodPendingVerification(uploaded.status)).toBe(true);

    // 2. Operations rejects
    const rejected = simReject(uploaded, "Signature missing", t0);
    expect(rejected.status).toBe("BAD_POD");
    expect(rejected.rejectionReason).toBe("Signature missing");
    expect(isBadPodUnresolved(rejected.status, rejected.resolutionStatus)).toBe(true);
    expect(rejected.slaDeadlineAt!.getTime()).toBe(t0.getTime() + POD_SLA_MS);

    // 3. Operations corrects/re-uploads
    const { badPod, newPod } = simCorrect(rejected, "pod-2");
    expect(badPod.resolutionStatus).toBe("CORRECTED");
    expect(badPod.status).toBe("BAD_POD"); // original never deleted
    expect(newPod.status).toBe("PENDING_VERIFICATION");
    expect(newPod.previousPodId).toBe("pod-1");

    // 4. Operations verifies corrected POD
    const verified = simVerify(newPod, new Date("2026-10-01T14:00:00Z"));
    expect(verified.status).toBe("VERIFIED");
    expect(verified.verifiedAt).not.toBeNull();

    // 5. History remains intact — original bad POD still exists
    expect(badPod.id).toBe("pod-1");
    expect(badPod.status).toBe("BAD_POD");
    expect(newPod.previousPodId).toBe("pod-1");
  });
});

describe("Acceptance: 24-hour SLA escalation", () => {
  it("escalates unresolved bad POD after 24 hours without auto-verifying", () => {
    const rejectedAt = new Date("2026-10-01T10:00:00Z");
    const badPod = simReject(simUpload("pod-bad"), "Illegible image", rejectedAt);

    // Within SLA — no escalation
    const withinSla = new Date(rejectedAt.getTime() + POD_SLA_MS - 1000);
    expect(simEscalate(badPod, withinSla)).toBeNull();
    expect(badPod.status).toBe("BAD_POD"); // never auto-verified

    // After SLA — escalation
    const afterSla = new Date(rejectedAt.getTime() + POD_SLA_MS + 1000);
    const escalated = simEscalate(badPod, afterSla);
    expect(escalated).not.toBeNull();
    expect(escalated!.resolutionStatus).toBe("SLA_BREACHED");
    expect(escalated!.status).toBe("BAD_POD"); // still bad, not verified
    expect(escalated!.verifiedAt).toBeNull();
    expect(isBadPodSlaBreached(escalated!.resolutionStatus)).toBe(true);
  });

  it("does not re-escalate already escalated PODs", () => {
    const rejectedAt = new Date("2026-10-01T10:00:00Z");
    const badPod = simReject(simUpload("pod-bad"), "Wrong document", rejectedAt);
    const afterSla = new Date(rejectedAt.getTime() + POD_SLA_MS + 5000);
    const escalated = simEscalate(badPod, afterSla)!;
    expect(simEscalate(escalated, afterSla)).toBeNull();
  });
});

describe("Permissions: verify/reject restricted to finance/admin", () => {
  it("VENDOR and DRIVER can upload but lack verify permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.VENDOR).not.toContain("pod.approve");
    expect(DEFAULT_ROLE_PERMISSIONS.VENDOR).not.toContain("pod.manage");
    expect(DEFAULT_ROLE_PERMISSIONS.DRIVER).toContain("pod.upload");
    expect(DEFAULT_ROLE_PERMISSIONS.DRIVER).not.toContain("pod.approve");
    expect(DEFAULT_ROLE_PERMISSIONS.OPERATIONS).not.toContain("pod.approve");
    expect(DEFAULT_ROLE_PERMISSIONS.OPERATIONS).not.toContain("pod.manage");
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCE).toContain("pod.approve");
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCE).toContain("pod.manage");
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN).toContain("pod.approve");
  });
});
