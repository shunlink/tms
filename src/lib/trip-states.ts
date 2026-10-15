// Manual trip status transitions (driver / operations). POD_RECEIVED, CLOSED and INVOICED
// are set only by the POD verification and invoicing workflows.

export const TRIP_MANUAL_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["CANCELLED"],
};

export const DRIVER_TRIP_STATUSES = ["DISPATCHED", "IN_TRANSIT", "DELIVERED"];

export function canManuallyTransitionTrip(from: string, to: string): boolean {
  return (TRIP_MANUAL_TRANSITIONS[from] ?? []).includes(to);
}
