/** POD (front + back) may be uploaded only after ops marks the trip delivered. */
export function canUploadTripPod(tripStatus: string | null | undefined): boolean {
  return tripStatus === "DELIVERED";
}

export const POD_UPLOAD_LOCKED_MESSAGE =
  "POD upload unlocks after this trip is marked as delivered. You can prepare photos until then.";

export const POD_ALREADY_SUBMITTED_MESSAGE =
  "A POD has already been submitted for this trip. Only operations can replace it from the indent POD verification panel.";

/** Trip-level POD queue state from indent pods (see getTripDetail). */
export type TripPodQueueState = "VERIFIED" | "PENDING_VERIFICATION" | "BAD_POD" | null;

export function deriveTripPodQueueState(
  pods: { status: string; resolutionStatus?: string | null }[]
): TripPodQueueState {
  if (pods.some((p) => p.status === "VERIFIED")) return "VERIFIED";
  if (pods.some((p) => p.status === "PENDING_VERIFICATION")) return "PENDING_VERIFICATION";
  if (pods.some((p) => p.status === "BAD_POD" && p.resolutionStatus !== "CORRECTED")) {
    return "BAD_POD";
  }
  return null;
}

export function tripPodAlreadySubmitted(podState: TripPodQueueState): boolean {
  return (
    podState === "VERIFIED" ||
    podState === "PENDING_VERIFICATION" ||
    podState === "BAD_POD"
  );
}

export function resolveTripPodUploadGate(
  tripStatus: string | null | undefined,
  podState: TripPodQueueState
): { allowed: boolean; message: string } {
  if (!canUploadTripPod(tripStatus)) {
    return { allowed: false, message: POD_UPLOAD_LOCKED_MESSAGE };
  }
  if (tripPodAlreadySubmitted(podState)) {
    return { allowed: false, message: POD_ALREADY_SUBMITTED_MESSAGE };
  }
  return { allowed: true, message: "" };
}
