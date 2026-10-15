// Shared domain constants (pure) — used by services and tests.

export const TRACKING_SOURCES = ["GPS", "CELL"] as const;
export type TrackingSource = (typeof TRACKING_SOURCES)[number];

/** How often the driver app posts GPS while a trip is active (tab must stay open). */
export const DRIVER_GPS_SHARE_INTERVAL_MS = 60 * 1000; // 1 minute

export const POD_SOURCES = ["DRIVER", "EMPLOYEE", "VENDOR"] as const;
export type PodSource = (typeof POD_SOURCES)[number];

/** Bad POD resolution SLA: 24 hours from rejection. */
export const POD_SLA_HOURS = 24;
export const POD_SLA_MS = POD_SLA_HOURS * 60 * 60 * 1000;

export const EVENT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type EventSeverity = (typeof EVENT_SEVERITIES)[number];

export const EVENT_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Placement deadline: vendorAllocatedAt + 24 hours. */
export const PLACEMENT_HOURS = 24;
export const PLACEMENT_DEADLINE_MS = PLACEMENT_HOURS * 60 * 60 * 1000;

export const ADVANCE_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;
export type AdvanceStatus = (typeof ADVANCE_STATUSES)[number];

/** ShunLink advance request SLA: 24 hours from request creation. */
export const ADVANCE_SLA_HOURS = 24;
export const ADVANCE_SLA_MS = ADVANCE_SLA_HOURS * 60 * 60 * 1000;

/** Post-POD invoice SLA: 24 hours from POD verification. */
export const INVOICE_SLA_HOURS = 24;
export const INVOICE_SLA_MS = INVOICE_SLA_HOURS * 60 * 60 * 1000;

/** Post-POD vendor balance payment SLA: 96 hours from POD verification. */
export const BALANCE_PAYMENT_SLA_HOURS = 96;
export const BALANCE_PAYMENT_SLA_MS = BALANCE_PAYMENT_SLA_HOURS * 60 * 60 * 1000;

export const ADVANCE_SOURCES = ["SHUNLINK", "INTERNAL", "EXTERNAL"] as const;
export type AdvanceSource = (typeof ADVANCE_SOURCES)[number];

/** ShunLink-managed workflow sources (vendor portal or internal on-behalf). */
export const MANAGED_ADVANCE_SOURCES = ["SHUNLINK", "INTERNAL"] as const;
export type ManagedAdvanceSource = (typeof MANAGED_ADVANCE_SOURCES)[number];

export function isManagedAdvanceSource(source: string): boolean {
  return (MANAGED_ADVANCE_SOURCES as readonly string[]).includes(source);
}

export function managedAdvanceSourceFilter() {
  return { source: { in: [...MANAGED_ADVANCE_SOURCES] } };
}

export const EXTERNAL_ADVANCE_PROVIDERS = ["NAVI", "OTHER"] as const;

/**
 * TDS withheld on vendor freight under Section 194C (percentage of freight amount).
 * Applicability is per-vendor via VendorCommercial.tdsApplicable.
 */
export const VENDOR_TDS_RATE = 0.02;

/** Maximum vendor advance as a fraction of trip vendor freight (vendorRate). */
export const MAX_ADVANCE_PERCENT_OF_FREIGHT = 0.85;
