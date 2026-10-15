type Decimalish = { toNumber(): number } | number | null | undefined;

type AdvanceSource = {
  advanceStatus?: string | null;
  advanceApproved?: { toNumber(): number } | null;
  advanceRequested?: { toNumber(): number } | null;
  payments?: { paymentType?: string; amount: { toNumber(): number } }[];
};

function num(v: Decimalish): number | null {
  if (v == null) return null;
  return typeof v === "number" ? v : v.toNumber();
}

/** Legacy indent-level advance (pre trip-advance workflow). Confirmed paid amount, includes 0. */
export function resolveIndentAdvanceAmount(indent: AdvanceSource): number | null {
  if (indent.advanceStatus !== "PAID") return null;
  const payment = indent.payments?.find((p) => p.paymentType === "ADVANCE");
  if (payment) return payment.amount.toNumber();
  if (indent.advanceApproved != null) return indent.advanceApproved.toNumber();
  if (indent.advanceRequested != null) return indent.advanceRequested.toNumber();
  return 0;
}

export type TripAdvanceRequestRow = {
  requestNumber?: string | null;
  source: string;
  status: string;
  requestedAmount?: Decimalish;
  negotiatedAmount?: Decimalish;
  approvedAmount?: Decimalish;
  paidAmount?: Decimalish;
  paymentMethod?: string | null;
  utrReference?: string | null;
  paymentDate?: Date | null;
  processedAt?: Date | null;
  externalProvider?: string | null;
  processedBy?: { name: string | null } | null;
  createdAt?: Date;
};

/** Unified vendor advance view for a trip (AdvanceRequest is source of truth). */
export type TripVendorAdvance = {
  requestNumber: string | null;
  requestedAmount: number | null;
  approvedAmount: number | null;
  paidAmount: number | null;
  /** Raw AdvanceRequest.status (PROCESSED, PENDING_REVIEW, EXTERNAL, …). */
  status: string;
  paymentDate: Date | null;
  paymentMethod: string | null;
  utrReference: string | null;
  /** Approved amount not yet paid (null when not applicable). */
  outstandingAmount: number | null;
  externalProvider: string | null;
  recordedBy: string | null;
};

const CLOSED_REQUEST_STATUSES = new Set(["REJECTED", "CANCELLED"]);

const OUTSTANDING_STATUSES = new Set([
  "APPROVED",
  "VENDOR_ACCEPTED",
  "PROCESSING",
  "SLA_BREACHED",
]);

export function isVendorAdvancePaidStatus(status: string): boolean {
  return status === "PAID" || status === "PROCESSED";
}

export function isVendorAdvanceClearedStatus(status: string): boolean {
  return status === "PROCESSED" || status === "EXTERNAL" || status === "PAID";
}

function computeOutstanding(
  approved: number | null,
  paid: number | null,
  status: string
): number | null {
  if (status === "PROCESSED") return 0;
  if (approved == null || !OUTSTANDING_STATUSES.has(status)) return null;
  return Math.max(0, approved - (paid ?? 0));
}

/**
 * Resolve vendor advance for a trip from AdvanceRequest rows.
 * Returns null when the trip has no live or processed advance request.
 */
export function resolveTripVendorAdvance(
  requests: TripAdvanceRequestRow[] | null | undefined
): TripVendorAdvance | null {
  if (!requests || requests.length === 0) return null;

  const sorted = [...requests].sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );

  const processed = sorted.filter((r) => r.status === "PROCESSED");
  if (processed.length > 0) {
    const latest = processed[0];
    const paid = processed.reduce((s, r) => s + (num(r.paidAmount) ?? 0), 0);
    const approved = num(latest.approvedAmount) ?? num(latest.negotiatedAmount);
    return {
      requestNumber: latest.requestNumber ?? null,
      requestedAmount: num(latest.requestedAmount),
      approvedAmount: approved,
      paidAmount: paid,
      status: "PROCESSED",
      paymentDate: latest.paymentDate ?? latest.processedAt ?? null,
      paymentMethod: latest.paymentMethod ?? null,
      utrReference: latest.utrReference ?? null,
      outstandingAmount: 0,
      externalProvider: null,
      recordedBy: latest.processedBy?.name ?? null,
    };
  }

  const live = sorted.find((r) => !CLOSED_REQUEST_STATUSES.has(r.status));
  if (!live) return null;

  if (live.status === "EXTERNAL") {
    const approved = num(live.approvedAmount);
    const requested = num(live.requestedAmount);
    return {
      requestNumber: live.requestNumber ?? null,
      requestedAmount: requested || null,
      approvedAmount: approved,
      paidAmount: null,
      status: "EXTERNAL",
      paymentDate: null,
      paymentMethod: null,
      utrReference: live.utrReference ?? null,
      outstandingAmount: null,
      externalProvider: live.externalProvider ?? null,
      recordedBy: null,
    };
  }

  const approved = num(live.approvedAmount) ?? num(live.negotiatedAmount);
  const paid = num(live.paidAmount);
  return {
    requestNumber: live.requestNumber ?? null,
    requestedAmount: num(live.requestedAmount),
    approvedAmount: approved,
    paidAmount: paid,
    status: live.status,
    paymentDate: live.paymentDate ?? null,
    paymentMethod: live.paymentMethod ?? null,
    utrReference: live.utrReference ?? null,
    outstandingAmount: computeOutstanding(approved, paid, live.status),
    externalProvider: null,
    recordedBy: live.processedBy?.name ?? null,
  };
}

/** @deprecated Use resolveTripVendorAdvance — kept for existing imports during migration. */
export type TripAdvanceSummary = TripVendorAdvance & {
  mode: string | null;
  reference: string | null;
  paidAt: Date | null;
};

/** @deprecated Use resolveTripVendorAdvance */
export function summarizeTripAdvance(
  requests: TripAdvanceRequestRow[] | null | undefined
): TripAdvanceSummary | null {
  const adv = resolveTripVendorAdvance(requests);
  if (!adv) return null;
  return {
    ...adv,
    mode: adv.paymentMethod,
    reference: adv.utrReference,
    paidAt: adv.paymentDate,
  };
}

/**
 * Advance amount to communicate to vendors (quotes, broadcasts, allocation notices).
 * Prefers trip AdvanceRequest when present; falls back to legacy indent advance fields.
 */
export function resolveIndentPromisedAdvanceAmount(indent: AdvanceSource & {
  trips?: { advanceRequests?: TripAdvanceRequestRow[] }[];
}): number | null {
  const tripAdv = resolveTripVendorAdvance(indent.trips?.[0]?.advanceRequests);
  if (tripAdv) {
    if (tripAdv.paidAmount != null && tripAdv.paidAmount > 0) return tripAdv.paidAmount;
    if (tripAdv.status === "EXTERNAL") {
      return tripAdv.approvedAmount ?? tripAdv.requestedAmount ?? 0;
    }
    if (tripAdv.approvedAmount != null && tripAdv.approvedAmount > 0) return tripAdv.approvedAmount;
    if (tripAdv.requestedAmount != null && tripAdv.requestedAmount > 0) return tripAdv.requestedAmount;
    return null;
  }

  if (indent.advanceStatus === "PAID") return resolveIndentAdvanceAmount(indent);
  if (indent.advanceStatus === "APPROVED" && indent.advanceApproved != null) {
    return indent.advanceApproved.toNumber();
  }
  if (indent.advanceStatus === "PENDING" && indent.advanceRequested != null) {
    return indent.advanceRequested.toNumber();
  }
  return null;
}

/** Prisma select for resolveTripVendorAdvance. */
export const tripAdvanceSummarySelect = {
  requestNumber: true,
  source: true,
  status: true,
  requestedAmount: true,
  negotiatedAmount: true,
  approvedAmount: true,
  paidAmount: true,
  paymentMethod: true,
  utrReference: true,
  paymentDate: true,
  processedAt: true,
  externalProvider: true,
  createdAt: true,
  processedBy: { select: { name: true } },
} as const;
