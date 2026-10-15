import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { parsePagination, paginated, type PaginatedResult } from "../pagination";
import { ACTIVE_BALANCE_PAYMENT_STATUSES } from "../balance-payment-states";
import { managedAdvanceSourceFilter } from "../constants";
import { sumOutstandingVendorPayables, computeOutstandingVendorPayables } from "./vendor-payables.service";
import { listVendorPayments } from "./vendor-payment.service";
import {
  COMMITTED_ADVANCE_STATUSES,
  advanceOutstandingAmount,
  balanceOutstandingAmount,
  buildPayableAgeingRows,
  buildPayablesSummary,
  derivePayableDisplayStatus,
  isAdvanceActionRequired,
  isBalanceActionRequired,
  resolveAdvanceAgeingAnchor,
  resolveAdvanceApprovedAmount,
  vendorPayableAgeingDays,
  type AgeingBucketFilter,
  type DetailedAgeingBuckets,
  type PayableDisplayStatus,
  type PayableTypeFilter,
  PAYABLE_AGEING_LABEL,
} from "../payables";
import { reconcilePayablesTotal } from "../finance-reconciliation";
import { detailedAgeingBucketForDays } from "../receivables";

type Decimalish = { toNumber(): number } | number | null | undefined;
const n = (v: Decimalish) => {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
};

export type PayablesSortField = "outstanding" | "oldestDue" | "vendor";
export type PayablesSortDir = "asc" | "desc";

export type PayablesFilters = {
  vendorId?: string;
  clientId?: string;
  tripLr?: string;
  status?: PayableDisplayStatus;
  payableType?: PayableTypeFilter;
  dateFrom?: Date;
  dateTo?: Date;
  minOutstanding?: number;
  maxOutstanding?: number;
  ageingBucket?: AgeingBucketFilter;
};

export type PayableVendorRow = {
  vendorId: string;
  vendorName: string;
  tripCount: number;
  grossPayable: number;
  advancePaid: number;
  advanceOutstanding: number;
  balancePayable: number;
  tds: number;
  netOutstanding: number;
  totalPaid: number;
  oldestDue: Date | null;
  ageingDays: number;
  ageingBucket: AgeingBucketFilter;
  displayStatus: PayableDisplayStatus;
  hasBalanceTask: boolean;
  hasAdvance: boolean;
  balanceTaskId: string | null;
  advanceRequestId: string | null;
  slaDeadline: Date | null;
};

export type PayablesSummary = {
  totalOutstanding: number;
  advancesOutstanding: number;
  balancePending: number;
  dueActionRequired: number;
  tdsToWithhold: number;
  vendorsWithOutstanding: number;
  buckets: DetailedAgeingBuckets;
  ageingLabel: string;
};

export type VendorPayableTripRow = {
  tripId: string;
  lrNumber: string;
  clientName: string;
  freight: number;
  additionalCharges: number;
  deductions: number;
  grossPayable: number;
  tds: number;
  advance: number;
  finalPayable: number;
  paid: number;
  outstanding: number;
  paymentStatus: PayableDisplayStatus;
  balanceTaskId: string | null;
  balanceTaskStatus: string | null;
  advanceRequestId: string | null;
  advanceRequestNumber: string | null;
  advanceStatus: string | null;
  ageingAnchor: Date | null;
  slaDeadline: Date | null;
};

export type VendorPayableSummary = {
  vendorId: string;
  vendorName: string;
  grossFreightPayable: number;
  additionalCharges: number;
  deductions: number;
  tds: number;
  advancesPaid: number;
  balancePaid: number;
  totalPaid: number;
  outstanding: number;
  trips: VendorPayableTripRow[];
  payments: Awaited<ReturnType<typeof listVendorPayments>>;
  ageingLabel: string;
};

const balanceTaskInclude = {
  vendor: { select: { id: true, name: true } },
  vendorTripPayable: { select: { commercialApprovalStatus: true } },
  trip: {
    select: {
      id: true,
      lrNumber: true,
      clientId: true,
      client: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.VendorBalancePaymentTaskInclude;

const advanceInclude = {
  vendor: { select: { id: true, name: true } },
  trip: {
    select: {
      id: true,
      lrNumber: true,
      clientId: true,
      client: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AdvanceRequestInclude;

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function parsePayablesFilters(
  searchParams: Record<string, string | string[] | undefined>
): PayablesFilters {
  const pick = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const minOutstanding = pick("minOutstanding");
  const maxOutstanding = pick("maxOutstanding");
  const status = pick("status") as PayableDisplayStatus | undefined;
  const ageingBucket = pick("ageingBucket") as AgeingBucketFilter | undefined;
  const payableType = pick("payableType") as PayableTypeFilter | undefined;

  return {
    vendorId: pick("vendorId") || undefined,
    clientId: pick("clientId") || undefined,
    tripLr: pick("tripLr")?.trim() || undefined,
    status:
      status &&
      ["UNPAID", "PARTIALLY_PAID", "ACTION_REQUIRED", "SLA_BREACHED"].includes(status)
        ? status
        : undefined,
    payableType: payableType === "ADVANCE" || payableType === "BALANCE" ? payableType : undefined,
    dateFrom: parseDate(pick("dateFrom")),
    dateTo: parseDate(pick("dateTo")),
    minOutstanding:
      minOutstanding != null && minOutstanding !== "" ? Number(minOutstanding) : undefined,
    maxOutstanding:
      maxOutstanding != null && maxOutstanding !== "" ? Number(maxOutstanding) : undefined,
    ageingBucket:
      ageingBucket &&
      ["current", "d1_30", "d31_60", "d61_90", "d90plus", "overdue"].includes(ageingBucket)
        ? ageingBucket
        : undefined,
  };
}

export function parsePayablesSort(
  searchParams: Record<string, string | string[] | undefined>
): { sort: PayablesSortField; dir: PayablesSortDir } {
  const pick = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const sort = pick("sort") as PayablesSortField | undefined;
  const dir = pick("dir") as PayablesSortDir | undefined;
  const validSort: PayablesSortField[] = ["outstanding", "oldestDue", "vendor"];
  return {
    sort: sort && validSort.includes(sort) ? sort : "outstanding",
    dir: dir === "asc" || dir === "desc" ? dir : "desc",
  };
}

type VendorAccumulator = {
  vendorId: string;
  vendorName: string;
  tripIds: Set<string>;
  grossPayable: number;
  advancePaid: number;
  advanceOutstanding: number;
  balancePayable: number;
  ledgerOutstanding: number;
  tds: number;
  totalPaid: number;
  oldestDue: Date | null;
  ageingDays: number;
  hasSlaBreached: boolean;
  hasPendingAction: boolean;
  hasBalanceTask: boolean;
  hasAdvance: boolean;
  balanceTaskId: string | null;
  advanceRequestId: string | null;
  slaDeadline: Date | null;
  balancePaid: number;
};

function getOrCreateVendor(map: Map<string, VendorAccumulator>, vendorId: string, vendorName: string) {
  let acc = map.get(vendorId);
  if (!acc) {
    acc = {
      vendorId,
      vendorName,
      tripIds: new Set(),
      grossPayable: 0,
      advancePaid: 0,
      advanceOutstanding: 0,
      balancePayable: 0,
      ledgerOutstanding: 0,
      tds: 0,
      totalPaid: 0,
      oldestDue: null,
      ageingDays: 0,
      hasSlaBreached: false,
      hasPendingAction: false,
      hasBalanceTask: false,
      hasAdvance: false,
      balanceTaskId: null,
      advanceRequestId: null,
      slaDeadline: null,
      balancePaid: 0,
    };
    map.set(vendorId, acc);
  }
  return acc;
}

function trackAgeing(acc: VendorAccumulator, anchor: Date, nowMs: number) {
  const days = vendorPayableAgeingDays(anchor, nowMs);
  if (!acc.oldestDue || anchor.getTime() < acc.oldestDue.getTime()) {
    acc.oldestDue = anchor;
    acc.ageingDays = days;
  }
}

function matchesDbScope(
  trip: { clientId: string; lrNumber: string },
  filters: PayablesFilters
): boolean {
  if (filters.clientId && trip.clientId !== filters.clientId) return false;
  if (filters.tripLr && !trip.lrNumber.toLowerCase().includes(filters.tripLr.toLowerCase())) {
    return false;
  }
  return true;
}

async function fetchPayablesData(filters: PayablesFilters) {
  const vendorWhere = filters.vendorId ? { vendorId: filters.vendorId } : {};
  const tripWhere: Prisma.TripWhereInput = {};
  if (filters.clientId) tripWhere.clientId = filters.clientId;
  if (filters.tripLr) {
    tripWhere.lrNumber = { contains: filters.tripLr, mode: "insensitive" };
  }
  const hasTripScope = Object.keys(tripWhere).length > 0;

  const [balanceTasks, advances, pendingLedger] = await Promise.all([
    prisma.vendorBalancePaymentTask.findMany({
      where: {
        ...vendorWhere,
        ...(hasTripScope ? { trip: tripWhere } : {}),
        status: { in: ACTIVE_BALANCE_PAYMENT_STATUSES },
      },
      include: balanceTaskInclude,
    }),
    prisma.advanceRequest.findMany({
      where: {
        ...vendorWhere,
        ...(hasTripScope ? { trip: tripWhere } : {}),
        ...managedAdvanceSourceFilter(),
        status: { in: [...COMMITTED_ADVANCE_STATUSES] },
      },
      include: advanceInclude,
    }),
    prisma.vendorPayment.findMany({
      where: {
        ...vendorWhere,
        ...(hasTripScope ? { trip: tripWhere } : {}),
        status: { in: ["PENDING", "APPROVED"] },
      },
      select: {
        id: true,
        vendorId: true,
        tripId: true,
        netPayable: true,
        paymentType: true,
        createdAt: true,
        vendor: { select: { id: true, name: true } },
        trip: {
          select: {
            id: true,
            lrNumber: true,
            clientId: true,
            client: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return { balanceTasks, advances, pendingLedger };
}

function buildVendorAccumulators(
  data: Awaited<ReturnType<typeof fetchPayablesData>>,
  filters: PayablesFilters,
  nowMs: number
): Map<string, VendorAccumulator> {
  const map = new Map<string, VendorAccumulator>();

  for (const task of data.balanceTasks) {
    if (!matchesDbScope(task.trip, filters)) continue;
    const outstanding = balanceOutstandingAmount({
      balanceAmount: n(task.balanceAmount),
      paidAmount: n(task.paidAmount),
    });

    if (outstanding <= 0) {
      if (isBalanceActionRequired(task.status)) {
        const acc = getOrCreateVendor(map, task.vendorId, task.vendor.name);
        acc.tripIds.add(task.tripId);
        acc.hasBalanceTask = true;
        acc.balanceTaskId = acc.balanceTaskId ?? task.id;
        acc.hasPendingAction = true;
        trackAgeing(acc, task.podVerifiedAt, nowMs);
      }
      continue;
    }

    const acc = getOrCreateVendor(map, task.vendorId, task.vendor.name);
    acc.tripIds.add(task.tripId);
    acc.grossPayable += n(task.freightAmount) + n(task.additionalChargesAmount) - n(task.deductionsAmount);
    acc.advancePaid += n(task.advanceAmount);
    acc.balancePayable += outstanding;
    acc.balancePaid += n(task.paidAmount);
    acc.tds += n(task.tdsAmount);
    acc.totalPaid += n(task.advanceAmount) + n(task.paidAmount);
    acc.hasBalanceTask = true;
    acc.balanceTaskId = acc.balanceTaskId ?? task.id;

    if (task.status === "SLA_BREACHED" || task.deadlineAt.getTime() < nowMs) {
      acc.hasSlaBreached = true;
    }
    if (isBalanceActionRequired(task.status)) {
      acc.hasPendingAction = true;
    }

    trackAgeing(acc, task.podVerifiedAt, nowMs);
    if (!acc.slaDeadline || task.deadlineAt.getTime() < acc.slaDeadline.getTime()) {
      acc.slaDeadline = task.deadlineAt;
    }
  }

  for (const adv of data.advances) {
    if (!matchesDbScope(adv.trip, filters)) continue;
    const outstanding = advanceOutstandingAmount({
      approvedAmount: n(adv.approvedAmount),
      negotiatedAmount: n(adv.negotiatedAmount),
      requestedAmount: n(adv.requestedAmount),
      paidAmount: n(adv.paidAmount),
    });
    if (outstanding <= 0) continue;

    const acc = getOrCreateVendor(map, adv.vendorId, adv.vendor.name);
    acc.tripIds.add(adv.tripId);
    acc.grossPayable += resolveAdvanceApprovedAmount({
      approvedAmount: n(adv.approvedAmount),
      negotiatedAmount: n(adv.negotiatedAmount),
      requestedAmount: n(adv.requestedAmount),
    });
    acc.advancePaid += n(adv.paidAmount);
    acc.advanceOutstanding += outstanding;
    acc.totalPaid += n(adv.paidAmount);
    acc.hasAdvance = true;
    acc.advanceRequestId = acc.advanceRequestId ?? adv.id;

    if (adv.status === "SLA_BREACHED" || adv.deadlineAt.getTime() < nowMs) {
      acc.hasSlaBreached = true;
    }
    if (isAdvanceActionRequired(adv.status)) {
      acc.hasPendingAction = true;
    }

    const anchor = resolveAdvanceAgeingAnchor({
      approvedAt: adv.approvedAt,
      vendorAcceptedAt: adv.vendorAcceptedAt,
      requestedAt: adv.requestedAt,
    });
    trackAgeing(acc, anchor, nowMs);
    if (!acc.slaDeadline || adv.deadlineAt.getTime() < acc.slaDeadline.getTime()) {
      acc.slaDeadline = adv.deadlineAt;
    }
  }

  for (const entry of data.pendingLedger) {
    const outstanding = n(entry.netPayable);
    if (outstanding <= 0) continue;
    if (entry.trip && !matchesDbScope(
      { clientId: entry.trip.clientId, lrNumber: entry.trip.lrNumber },
      filters
    )) {
      continue;
    }

    const acc = getOrCreateVendor(map, entry.vendorId, entry.vendor.name);
    if (entry.tripId) acc.tripIds.add(entry.tripId);
    acc.ledgerOutstanding += outstanding;
    acc.grossPayable += outstanding;
    trackAgeing(acc, entry.createdAt, nowMs);
  }

  return map;
}

function mapAccumulatorToRow(acc: VendorAccumulator, nowMs: number): PayableVendorRow {
  const netOutstanding = Math.round(
    (acc.advanceOutstanding + acc.balancePayable + acc.ledgerOutstanding) * 100
  ) / 100;

  const displayStatus = derivePayableDisplayStatus({
    balanceOutstanding: acc.balancePayable + acc.ledgerOutstanding,
    advanceOutstanding: acc.advanceOutstanding,
    balancePaid: acc.balancePaid,
    advancePaid: acc.advancePaid,
    hasSlaBreached: acc.hasSlaBreached,
    hasPendingAction: acc.hasPendingAction,
  });

  return {
    vendorId: acc.vendorId,
    vendorName: acc.vendorName,
    tripCount: acc.tripIds.size,
    grossPayable: Math.round(acc.grossPayable * 100) / 100,
    advancePaid: Math.round(acc.advancePaid * 100) / 100,
    advanceOutstanding: Math.round(acc.advanceOutstanding * 100) / 100,
    balancePayable: Math.round((acc.balancePayable + acc.ledgerOutstanding) * 100) / 100,
    tds: Math.round(acc.tds * 100) / 100,
    netOutstanding,
    totalPaid: Math.round(acc.totalPaid * 100) / 100,
    oldestDue: acc.oldestDue,
    ageingDays: acc.ageingDays,
    ageingBucket: detailedAgeingBucketForDays(acc.ageingDays),
    displayStatus,
    hasBalanceTask: acc.hasBalanceTask,
    hasAdvance: acc.hasAdvance,
    balanceTaskId: acc.balanceTaskId,
    advanceRequestId: acc.advanceRequestId,
    slaDeadline: acc.slaDeadline,
  };
}

export function applyPayableComputedFilters(
  rows: PayableVendorRow[],
  filters: PayablesFilters
): PayableVendorRow[] {
  return rows.filter((row) => {
    if (filters.status && row.displayStatus !== filters.status) return false;
    if (filters.payableType === "ADVANCE" && row.advanceOutstanding <= 0) return false;
    if (filters.payableType === "BALANCE" && row.balancePayable <= 0) return false;
    if (filters.ageingBucket === "overdue") {
      if (row.ageingDays <= 0) return false;
    } else if (filters.ageingBucket && row.ageingBucket !== filters.ageingBucket) {
      return false;
    }
    if (filters.dateFrom && row.oldestDue && row.oldestDue < filters.dateFrom) return false;
    if (filters.dateTo && row.oldestDue && row.oldestDue > endOfDay(filters.dateTo)) return false;
    if (filters.minOutstanding != null && row.netOutstanding < filters.minOutstanding) return false;
    if (filters.maxOutstanding != null && row.netOutstanding > filters.maxOutstanding) return false;
    return true;
  });
}

export function sortPayableRows(
  rows: PayableVendorRow[],
  sort: PayablesSortField,
  dir: PayablesSortDir
): PayableVendorRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "vendor":
        cmp = a.vendorName.localeCompare(b.vendorName);
        break;
      case "oldestDue": {
        const aTime = a.oldestDue?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.oldestDue?.getTime() ?? Number.MAX_SAFE_INTEGER;
        cmp = aTime - bTime;
        break;
      }
      case "outstanding":
      default:
        cmp = a.netOutstanding - b.netOutstanding;
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return copy;
}

export async function listPayablesPaginated(
  filters: PayablesFilters,
  paginationParams: Record<string, string | string[] | undefined>,
  sortParams: { sort: PayablesSortField; dir: PayablesSortDir },
  nowMs = Date.now()
): Promise<PaginatedResult<PayableVendorRow>> {
  const { skip, take, page, pageSize } = parsePagination(paginationParams);
  const data = await fetchPayablesData(filters);
  const accumulators = buildVendorAccumulators(data, filters, nowMs);

  let rows = Array.from(accumulators.values())
    .map((acc) => mapAccumulatorToRow(acc, nowMs))
    .filter((r) => r.netOutstanding > 0);

  rows = applyPayableComputedFilters(rows, filters);

  const defaultSort = { sort: "outstanding" as const, dir: "desc" as const };
  const sort = sortParams.sort === "outstanding" && !paginationParams.sort ? defaultSort : sortParams;
  if (sort.sort === "outstanding" && sort.dir === "desc") {
    rows.sort((a, b) => {
      const outCmp = b.netOutstanding - a.netOutstanding;
      if (outCmp !== 0) return outCmp;
      const aTime = a.oldestDue?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.oldestDue?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  } else {
    rows = sortPayableRows(rows, sort.sort, sort.dir);
  }

  const total = rows.length;
  const items = rows.slice(skip, skip + take);
  return paginated(items, total, page, pageSize);
}

export async function getPayablesSummary(
  filters: PayablesFilters,
  nowMs = Date.now()
): Promise<PayablesSummary> {
  const data = await fetchPayablesData(filters);
  const accumulators = buildVendorAccumulators(data, filters, nowMs);

  const summaryInputs = Array.from(accumulators.values())
    .map((acc) => {
      const netOutstanding = acc.advanceOutstanding + acc.balancePayable + acc.ledgerOutstanding;
      if (netOutstanding <= 0 || !acc.oldestDue) return null;

      const row = mapAccumulatorToRow(acc, nowMs);
      if (filters.status && row.displayStatus !== filters.status) return null;
      if (filters.payableType === "ADVANCE" && row.advanceOutstanding <= 0) return null;
      if (filters.payableType === "BALANCE" && row.balancePayable <= 0) return null;
      if (filters.ageingBucket === "overdue" && row.ageingDays <= 0) return null;
      if (filters.ageingBucket && filters.ageingBucket !== "overdue" && row.ageingBucket !== filters.ageingBucket) {
        return null;
      }
      if (filters.minOutstanding != null && netOutstanding < filters.minOutstanding) return null;
      if (filters.maxOutstanding != null && netOutstanding > filters.maxOutstanding) return null;

      return {
        vendorId: acc.vendorId,
        vendorName: acc.vendorName,
        tripLr: `${acc.tripIds.size} trip(s)`,
        outstanding: netOutstanding,
        ageingAnchor: acc.oldestDue,
        payableType: acc.advanceOutstanding > 0 && acc.balancePayable <= 0 ? ("ADVANCE" as const) : ("BALANCE" as const),
        advanceOutstanding: acc.advanceOutstanding,
        balanceOutstanding: acc.balancePayable,
        ledgerOutstanding: acc.ledgerOutstanding,
        tdsAmount: acc.tds,
        hasSlaBreached: acc.hasSlaBreached,
        hasPendingAction: acc.hasPendingAction,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const built = buildPayablesSummary(summaryInputs, nowMs);

  const pendingLedgerTotal = data.pendingLedger.reduce((s, p) => s + n(p.netPayable), 0);
  const verifyTotal = sumOutstandingVendorPayables({
    balanceTasks: data.balanceTasks.map((t) => ({
      balanceAmount: t.balanceAmount,
      paidAmount: t.paidAmount,
    })),
    advances: data.advances,
    pendingLedgerTotal,
  });
  const reconciled = reconcilePayablesTotal(
    data.balanceTasks.map((t) => ({
      balanceAmount: n(t.balanceAmount),
      paidAmount: n(t.paidAmount),
    })),
    data.advances.map((a) => ({
      approvedAmount: n(a.approvedAmount),
      negotiatedAmount: n(a.negotiatedAmount),
      requestedAmount: n(a.requestedAmount),
      paidAmount: n(a.paidAmount),
    })),
    pendingLedgerTotal,
    verifyTotal
  );
  if (!reconciled.ok) {
    console.warn("[payables] reconciliation:", reconciled.message);
  }

  return {
    ...built,
    totalOutstanding: Math.round(verifyTotal * 100) / 100,
  };
}

export async function getVendorPayableSummary(vendorId: string): Promise<VendorPayableSummary | null> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: { id: true, name: true },
  });
  if (!vendor) return null;

  const nowMs = Date.now();
  const data = await fetchPayablesData({ vendorId });
  const tripMap = new Map<string, VendorPayableTripRow>();

  for (const task of data.balanceTasks) {
    const outstanding = balanceOutstandingAmount({
      balanceAmount: n(task.balanceAmount),
      paidAmount: n(task.paidAmount),
    });
    const paid = n(task.advanceAmount) + n(task.paidAmount);
    const existing = tripMap.get(task.tripId);
    const row: VendorPayableTripRow = {
      tripId: task.tripId,
      lrNumber: task.trip.lrNumber,
      clientName: task.trip.client.name,
      freight: n(task.freightAmount),
      additionalCharges: n(task.additionalChargesAmount),
      deductions: n(task.deductionsAmount),
      grossPayable: n(task.freightAmount) + n(task.additionalChargesAmount) - n(task.deductionsAmount),
      tds: n(task.tdsAmount),
      advance: n(task.advanceAmount),
      finalPayable: n(task.finalPayableAmount),
      paid,
      outstanding: (existing?.outstanding ?? 0) + outstanding,
      paymentStatus: derivePayableDisplayStatus({
        balanceOutstanding: outstanding,
        advanceOutstanding: existing?.outstanding ? 0 : 0,
        balancePaid: n(task.paidAmount),
        advancePaid: n(task.advanceAmount),
        hasSlaBreached: task.status === "SLA_BREACHED" || task.deadlineAt.getTime() < nowMs,
        hasPendingAction: isBalanceActionRequired(task.status),
      }),
      balanceTaskId: task.id,
      balanceTaskStatus: task.status,
      advanceRequestId: existing?.advanceRequestId ?? null,
      advanceRequestNumber: existing?.advanceRequestNumber ?? null,
      advanceStatus: existing?.advanceStatus ?? null,
      ageingAnchor: task.podVerifiedAt,
      slaDeadline: task.deadlineAt,
    };
    if (existing) {
      row.advanceRequestId = existing.advanceRequestId;
      row.advanceRequestNumber = existing.advanceRequestNumber;
      row.advanceStatus = existing.advanceStatus;
      row.outstanding = existing.outstanding + outstanding;
    }
    tripMap.set(task.tripId, row);
  }

  for (const adv of data.advances) {
    const outstanding = advanceOutstandingAmount({
      approvedAmount: n(adv.approvedAmount),
      negotiatedAmount: n(adv.negotiatedAmount),
      requestedAmount: n(adv.requestedAmount),
      paidAmount: n(adv.paidAmount),
    });
    if (outstanding <= 0 && !tripMap.has(adv.tripId)) continue;

    const existing = tripMap.get(adv.tripId);
    const approved = resolveAdvanceApprovedAmount({
      approvedAmount: n(adv.approvedAmount),
      negotiatedAmount: n(adv.negotiatedAmount),
      requestedAmount: n(adv.requestedAmount),
    });
    const anchor = resolveAdvanceAgeingAnchor({
      approvedAt: adv.approvedAt,
      vendorAcceptedAt: adv.vendorAcceptedAt,
      requestedAt: adv.requestedAt,
    });

    if (existing) {
      existing.outstanding += outstanding;
      existing.advanceRequestId = adv.id;
      existing.advanceRequestNumber = adv.requestNumber;
      existing.advanceStatus = adv.status;
      if (outstanding > 0) {
        existing.paymentStatus = derivePayableDisplayStatus({
          balanceOutstanding: existing.outstanding - outstanding,
          advanceOutstanding: outstanding,
          balancePaid: existing.paid,
          advancePaid: n(adv.paidAmount),
          hasSlaBreached:
            adv.status === "SLA_BREACHED" ||
            adv.deadlineAt.getTime() < nowMs ||
            existing.paymentStatus === "SLA_BREACHED",
          hasPendingAction:
            isAdvanceActionRequired(adv.status) ||
            existing.paymentStatus === "ACTION_REQUIRED",
        });
      }
    } else if (outstanding > 0) {
      tripMap.set(adv.tripId, {
        tripId: adv.tripId,
        lrNumber: adv.trip.lrNumber,
        clientName: adv.trip.client.name,
        freight: 0,
        additionalCharges: 0,
        deductions: 0,
        grossPayable: approved,
        tds: 0,
        advance: approved,
        finalPayable: approved,
        paid: n(adv.paidAmount),
        outstanding,
        paymentStatus: derivePayableDisplayStatus({
          balanceOutstanding: 0,
          advanceOutstanding: outstanding,
          balancePaid: 0,
          advancePaid: n(adv.paidAmount),
          hasSlaBreached: adv.status === "SLA_BREACHED" || adv.deadlineAt.getTime() < nowMs,
          hasPendingAction: isAdvanceActionRequired(adv.status),
        }),
        balanceTaskId: null,
        balanceTaskStatus: null,
        advanceRequestId: adv.id,
        advanceRequestNumber: adv.requestNumber,
        advanceStatus: adv.status,
        ageingAnchor: anchor,
        slaDeadline: adv.deadlineAt,
      });
    }
  }

  const trips = Array.from(tripMap.values())
    .filter((t) => t.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  let grossFreightPayable = 0;
  let additionalCharges = 0;
  let deductions = 0;
  let tds = 0;
  let advancesPaid = 0;
  let balancePaid = 0;

  for (const task of data.balanceTasks) {
    grossFreightPayable += n(task.freightAmount);
    additionalCharges += n(task.additionalChargesAmount);
    deductions += n(task.deductionsAmount);
    tds += n(task.tdsAmount);
    advancesPaid += n(task.advanceAmount);
    balancePaid += n(task.paidAmount);
  }
  for (const adv of data.advances) {
    advancesPaid += n(adv.paidAmount);
  }

  const outstanding = await computeOutstandingVendorPayables(vendorId);
  const payments = await listVendorPayments({ vendorId });

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    grossFreightPayable: Math.round(grossFreightPayable * 100) / 100,
    additionalCharges: Math.round(additionalCharges * 100) / 100,
    deductions: Math.round(deductions * 100) / 100,
    tds: Math.round(tds * 100) / 100,
    advancesPaid: Math.round(advancesPaid * 100) / 100,
    balancePaid: Math.round(balancePaid * 100) / 100,
    totalPaid: Math.round((advancesPaid + balancePaid) * 100) / 100,
    outstanding: Math.round(outstanding * 100) / 100,
    trips,
    payments,
    ageingLabel: PAYABLE_AGEING_LABEL,
  };
}

export async function getPayablesFilterOptions() {
  const [vendors, clients, trips] = await Promise.all([
    prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.trip.findMany({
      where: {
        OR: [
          { balancePaymentTask: { status: { in: ACTIVE_BALANCE_PAYMENT_STATUSES } } },
          {
            advanceRequests: {
              some: { ...managedAdvanceSourceFilter(), status: { in: [...COMMITTED_ADVANCE_STATUSES] } },
            },
          },
        ],
      },
      select: { lrNumber: true },
      orderBy: { lrNumber: "asc" },
      take: 200,
    }),
  ]);

  return { vendors, clients, trips };
}

export { buildPayableAgeingRows };
