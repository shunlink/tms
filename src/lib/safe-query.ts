import { logQueryError } from "./prisma-errors";

/** Run a read query; on failure log and return a safe fallback (empty list, zero counts, null). */
export async function safeQuery<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") throw e;
    logQueryError(label, e);
    return fallback;
  }
}

export type OnboardingQueueRow = {
  id: string;
  name: string;
  onboardingStatus: string;
  onboardingRemarks: string | null;
  createdAt: Date;
  createdByLabel?: string | null;
};

export type OnboardingQueueDriverRow = OnboardingQueueRow & { phone: string };

export const EMPTY_DASHBOARD = {
  activeTrips: 0,
  activeClients: 0,
  activeVendors: 0,
  pendingPods: 0,
  pendingInvoiceAmount: 0,
  invoiceCount: 0,
  vendorPayables: 0,
  monthlyRevenue: 0,
  monthlyMargin: 0,
  docExpiries: 0,
  tripsTotal: 0,
  tripStatus: {} as Record<string, number>,
  bookingBuckets: [] as { key: string; label: string; value: number; color: string; highlight?: boolean }[],
  indentBuckets: [] as { key: string; label: string; value: number; color: string; highlight?: boolean }[],
  inProgressTrips: 0,
  totalVehicles: 0,
  activeVehicles: 0,
  totalIndents: 0,
  indentStatus: {} as Record<string, number>,
  indentsDraft: 0,
  importantEventsOpen: 0,
  placementPending: 0,
  podsPendingVerification: 0,
  badPodTasks: 0,
  invoiceTasksPending: 0,
  clientPaymentsThisMonth: 0,
  clientPaymentsCount: 0,
  externalAdvanceCount: 0,
  recentTrips: [] as {
    id: string;
    lrNumber: string;
    route: string;
    client: string;
    vendor: string;
    status: string;
  }[],
};

export const EMPTY_ONBOARDING_QUEUE = {
  clients: [] as OnboardingQueueRow[],
  vendors: [] as OnboardingQueueRow[],
  drivers: [] as OnboardingQueueDriverRow[],
  vehicles: [] as OnboardingQueueRow[],
};

export const EMPTY_CLIENT_PORTAL = {
  clientName: "Client",
  active: 0,
  inTransit: 0,
  delivered: 0,
  outstanding: 0,
  recentTrips: [] as {
    id: string;
    lrNumber: string;
    route: string;
    vehicle: string;
    vendor: string;
    status: string;
  }[],
};

export const EMPTY_VENDOR_PORTAL = {
  vendorName: "Vendor",
  active: 0,
  delivered: 0,
  availableIndents: 0,
  allocatedIndents: 0,
  pendingPods: 0,
  pendingPodTrips: [] as { id: string; lrNumber: string; route: string; vehicle: string }[],
  pendingPay: 0,
  paidPay: 0,
  recentTrips: [] as {
    id: string;
    href: string;
    lrNumber: string;
    route: string;
    vehicle: string;
    status: string;
    vendorRate: number;
  }[],
};

export const EMPTY_VENDOR_ASSIGNMENTS = {
  assignments: [] as {
    indentId: string;
    indentNumber: string;
    client: string;
    route: string;
    vehicleType: string;
    vendorRate: number;
    currentVehicleId: string | null;
    currentDriverId: string | null;
  }[],
  vehicles: [] as { id: string; number: string; type: string }[],
  drivers: [] as { id: string; name: string; phone: string }[],
};

export const EMPTY_AGEING = {
  buckets: { d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 },
  rows: [] as { client: string; invoiceNumber: string; balance: number; days: number }[],
  total: 0,
};

export const EMPTY_FORM_OPTIONS = {
  clients: [] as { id: string; name: string }[],
  vendors: [] as { id: string; name: string }[],
  vehicles: [] as { id: string; number: string; type: string }[],
  drivers: [] as { id: string; name: string; phone: string }[],
};
