// Indent lifecycle state machine — the single operational source of truth.
// Every status change is validated against these transitions (server-side).

export const INDENT_STATUSES = [
  "DRAFT",
  "WAITING_FOR_ADVANCE",
  "ADVANCE_PENDING",
  "ADVANCE_PAID",
  "RELEASED_TO_VENDORS",
  "QUOTING",
  "VENDOR_ALLOCATED",
  "PLACEMENT_PENDING",
  "VEHICLE_PLACED",
  "DRIVER_ASSIGNED",
  "IN_TRANSIT",
  "DELIVERED",
  "POD_PENDING",
  "POD_RECEIVED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type IndentStatus = (typeof INDENT_STATUSES)[number];

export const INDENT_TRANSITIONS: Record<string, IndentStatus[]> = {
  DRAFT: ["WAITING_FOR_ADVANCE", "ADVANCE_PAID", "RELEASED_TO_VENDORS", "CANCELLED"],
  WAITING_FOR_ADVANCE: ["ADVANCE_PENDING", "ADVANCE_PAID", "RELEASED_TO_VENDORS", "CANCELLED"],
  ADVANCE_PENDING: ["ADVANCE_PAID", "WAITING_FOR_ADVANCE", "RELEASED_TO_VENDORS", "CANCELLED"],
  ADVANCE_PAID: ["RELEASED_TO_VENDORS", "CANCELLED"],
  RELEASED_TO_VENDORS: ["QUOTING", "VENDOR_ALLOCATED", "CANCELLED"],
  QUOTING: ["VENDOR_ALLOCATED", "CANCELLED"],
  VENDOR_ALLOCATED: ["PLACEMENT_PENDING", "VENDOR_ALLOCATED", "CANCELLED"],
  PLACEMENT_PENDING: ["VEHICLE_PLACED", "VENDOR_ALLOCATED", "CANCELLED"],
  // Reallocation resets operational workflow back to placement.
  VEHICLE_PLACED: ["DRIVER_ASSIGNED", "PLACEMENT_PENDING", "CANCELLED"],
  DRIVER_ASSIGNED: ["IN_TRANSIT", "PLACEMENT_PENDING", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["POD_PENDING", "CANCELLED"],
  POD_PENDING: ["POD_RECEIVED", "CANCELLED"],
  POD_RECEIVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (INDENT_TRANSITIONS[from] ?? []).includes(to as IndentStatus);
}

export function assertTransition(from: string, to: string) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition: ${from} → ${to}`);
  }
}
