/** POD verification lifecycle statuses. */
export const POD_STATUSES = ["INCOMPLETE", "PENDING_VERIFICATION", "VERIFIED", "BAD_POD"] as const;
export type PodStatus = (typeof POD_STATUSES)[number];

/** Bad POD resolution tracking — separate from verification status. */
export const POD_RESOLUTION_STATUSES = ["PENDING", "CORRECTED", "SLA_BREACHED"] as const;
export type PodResolutionStatus = (typeof POD_RESOLUTION_STATUSES)[number];

export const POD_TRANSITIONS: Record<PodStatus, PodStatus[]> = {
  INCOMPLETE: ["PENDING_VERIFICATION"],
  PENDING_VERIFICATION: ["VERIFIED", "BAD_POD"],
  VERIFIED: [],
  BAD_POD: [],
};

export function canPodTransition(from: PodStatus, to: PodStatus): boolean {
  return POD_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertPodTransition(from: string, to: PodStatus): void {
  if (!canPodTransition(from as PodStatus, to)) {
    throw new Error(`Invalid POD transition: ${from} → ${to}`);
  }
}

/** Whether a POD record is awaiting operations review. */
export function isPodPendingVerification(status: string): boolean {
  return status === "PENDING_VERIFICATION";
}

/** Whether a POD was rejected and needs correction. */
export function isBadPod(status: string): boolean {
  return status === "BAD_POD";
}

/** Whether a bad POD is still within the 24-hour resolution window. */
export function isBadPodUnresolved(
  status: string,
  resolutionStatus: string | null | undefined
): boolean {
  return status === "BAD_POD" && resolutionStatus === "PENDING";
}

/** Whether the 24-hour SLA has been breached for a bad POD. */
export function isBadPodSlaBreached(resolutionStatus: string | null | undefined): boolean {
  return resolutionStatus === "SLA_BREACHED";
}
