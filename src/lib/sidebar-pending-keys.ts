import type { PermissionKey } from "./permissions";

/** Keys returned by GET /api/sidebar/pending-counts */
export type SidebarPendingCountKey =
  | "invoices"
  | "clientPayments"
  | "vendorPayments"
  | "balancePayments"
  | "advancePayments"
  | "indents"
  | "placement"
  | "onboarding"
  | "onboardingRequests"
  | "requirements"
  | "trips"
  | "pods"
  | "audit"
  | "notifications"
  | "vendorOpenIndents"
  | "vendorTrips"
  | "vendorPaymentsPortal"
  | "clientInvoices";

export type SidebarPendingCounts = Partial<Record<SidebarPendingCountKey, number>>;

/** Actionable work counts only (excludes notification unread). */
export type SidebarPendingActionCounts = Omit<SidebarPendingCounts, "notifications">;

/** Permission required to receive each pending-count key. */
export const PENDING_COUNT_PERMISSIONS: Record<SidebarPendingCountKey, PermissionKey | null> = {
  invoices: "invoice.view",
  clientPayments: "client.payment.manage",
  vendorPayments: "payment.view",
  balancePayments: "payment.view",
  advancePayments: "advance.view",
  indents: "indent.view",
  placement: "placement.view",
  onboarding: "users.manage",
  onboardingRequests: "onboarding.ops",
  requirements: "requirement.view",
  trips: "trip.view",
  pods: "pod.view",
  audit: "audit.view",
  notifications: "notifications.manage",
  vendorOpenIndents: null,
  vendorTrips: null,
  vendorPaymentsPortal: null,
  clientInvoices: null,
};

export function formatPendingCount(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}
