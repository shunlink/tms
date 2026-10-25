/** Trip statuses where vendor may still open a new ShunLink/external advance request. */
export const ADVANCE_REQUEST_ALLOWED_TRIP_STATUSES = [
  "PENDING",
  "DISPATCHED",
  "IN_TRANSIT",
] as const;

export type AdvanceRequestAllowedTripStatus = (typeof ADVANCE_REQUEST_ALLOWED_TRIP_STATUSES)[number];

export const ADVANCE_WINDOW_CLOSED_MESSAGE =
  "Advance can only be requested before the trip is marked delivered. Remaining freight will be paid as balance after POD verification.";

export function isTripStatusInAdvanceWindow(status: string): boolean {
  return (ADVANCE_REQUEST_ALLOWED_TRIP_STATUSES as readonly string[]).includes(status);
}

export function assertTripAdvanceWindowOpen(status: string) {
  if (isTripStatusInAdvanceWindow(status)) return;
  throw new Error(ADVANCE_WINDOW_CLOSED_MESSAGE);
}
