import { INDENT_STATUSES } from "./indent-states";

/** All trip statuses used in the TMS booking lifecycle. */
export const TRIP_STATUSES = [
  "PENDING",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "POD_RECEIVED",
  "INVOICED",
  "CLOSED",
  "CANCELLED",
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export type MetricBucket = {
  key: string;
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
};

/** Active trips — not yet delivered. */
export const TRIP_ACTIVE_STATUSES: TripStatus[] = ["PENDING", "DISPATCHED", "IN_TRANSIT"];

/** Delivered or post-delivery (portal "Delivered" grouping). */
export const TRIP_DELIVERED_GROUP: TripStatus[] = [
  "DELIVERED",
  "POD_RECEIVED",
  "INVOICED",
  "CLOSED",
];

const BOOKING_BUCKET_DEFS: Array<{
  key: string;
  label: string;
  statuses: TripStatus[];
  color: string;
  highlight?: boolean;
}> = [
  { key: "not_started", label: "Not Started", statuses: ["PENDING"], color: "#94A3B8" },
  {
    key: "trip_started",
    label: "Trip Started",
    statuses: ["DISPATCHED", "IN_TRANSIT"],
    color: "#1D4ED8",
    highlight: true,
  },
  {
    key: "pending_pod",
    label: "Pending Delivery Proof",
    statuses: ["DELIVERED"],
    color: "#D4842A",
    highlight: true,
  },
  {
    key: "proof_billing",
    label: "Proof / Billing",
    statuses: ["POD_RECEIVED", "INVOICED"],
    color: "#7C3AED",
  },
  { key: "trip_closed", label: "Trip Closed", statuses: ["CLOSED"], color: "#15803D", highlight: true },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"], color: "#DC2626" },
];

const INDENT_BUCKET_DEFS: Array<{
  key: string;
  label: string;
  statuses: string[];
  color: string;
  highlight?: boolean;
}> = [
  { key: "draft", label: "Draft", statuses: ["DRAFT"], color: "#94A3B8" },
  {
    key: "advance",
    label: "Advance / Approval",
    statuses: ["WAITING_FOR_ADVANCE", "ADVANCE_PENDING", "ADVANCE_PAID"],
    color: "#6366F1",
  },
  {
    key: "released",
    label: "Released / Quoting",
    statuses: ["RELEASED_TO_VENDORS", "QUOTING"],
    color: "#0EA5E9",
  },
  {
    key: "in_execution",
    label: "In Execution",
    statuses: [
      "VENDOR_ALLOCATED",
      "PLACEMENT_PENDING",
      "VEHICLE_PLACED",
      "DRIVER_ASSIGNED",
      "IN_TRANSIT",
    ],
    color: "#1D4ED8",
    highlight: true,
  },
  {
    key: "delivered_pod",
    label: "Delivered / POD",
    statuses: ["DELIVERED", "POD_PENDING", "POD_RECEIVED"],
    color: "#D4842A",
  },
  { key: "completed", label: "Completed", statuses: ["COMPLETED"], color: "#15803D", highlight: true },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"], color: "#DC2626" },
];

function sumStatuses(statusMap: Record<string, number>, statuses: string[]): number {
  return statuses.reduce((sum, s) => sum + (statusMap[s] ?? 0), 0);
}

function buildBuckets(
  statusMap: Record<string, number>,
  defs: Array<{ key: string; label: string; statuses: string[]; color: string; highlight?: boolean }>
): MetricBucket[] {
  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    value: sumStatuses(statusMap, d.statuses),
    color: d.color,
    highlight: d.highlight,
  }));
}

export function buildBookingBuckets(tripStatus: Record<string, number>): MetricBucket[] {
  return buildBuckets(tripStatus, BOOKING_BUCKET_DEFS);
}

export function buildIndentBuckets(indentStatus: Record<string, number>): MetricBucket[] {
  return buildBuckets(indentStatus, INDENT_BUCKET_DEFS);
}

export function bucketTotal(buckets: MetricBucket[]): number {
  return buckets.reduce((s, b) => s + b.value, 0);
}

export function countTripStatuses(
  tripStatus: Record<string, number>,
  statuses: TripStatus[]
): number {
  return sumStatuses(tripStatus, statuses);
}

/** Trip Started bucket value (DISPATCHED + IN_TRANSIT). */
export function tripStartedCount(tripStatus: Record<string, number>): number {
  return countTripStatuses(tripStatus, ["DISPATCHED", "IN_TRANSIT"]);
}

/** Pending delivery proof = DELIVERED only. */
export function pendingPodCount(tripStatus: Record<string, number>): number {
  return tripStatus.DELIVERED ?? 0;
}

/** Portal / delivered grouping. */
export function tripDeliveredCount(tripStatus: Record<string, number>): number {
  return countTripStatuses(tripStatus, TRIP_DELIVERED_GROUP);
}

/** Active shipment count for portals. */
export function tripActiveCount(tripStatus: Record<string, number>): number {
  return countTripStatuses(tripStatus, TRIP_ACTIVE_STATUSES);
}

export function indentDraftCount(indentStatus: Record<string, number>): number {
  return indentStatus.DRAFT ?? 0;
}

export function assertBucketsSumToTotal(
  buckets: MetricBucket[],
  total: number,
  label: string
): void {
  const sum = bucketTotal(buckets);
  if (sum !== total) {
    const msg = `[dashboard-metrics] ${label}: bucket sum ${sum} !== total ${total}`;
    if (process.env.NODE_ENV !== "production") {
      throw new Error(msg);
    }
    console.error(msg);
  }
}

/** Dev/test helper: ensure every known status is in exactly one bucket. */
export function validateBucketCoverage(
  allStatuses: readonly string[],
  defs: Array<{ statuses: string[] }>
): void {
  const assigned = new Set<string>();
  for (const d of defs) {
    for (const s of d.statuses) {
      if (assigned.has(s)) throw new Error(`Status ${s} assigned to multiple buckets`);
      assigned.add(s);
    }
  }
  for (const s of allStatuses) {
    if (!assigned.has(s)) throw new Error(`Status ${s} not assigned to any bucket`);
  }
}

// Validate at module load in development
if (process.env.NODE_ENV !== "production") {
  validateBucketCoverage(TRIP_STATUSES, BOOKING_BUCKET_DEFS);
  validateBucketCoverage(INDENT_STATUSES, INDENT_BUCKET_DEFS);
}
