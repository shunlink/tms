import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { invoiceOutstanding } from "../invoice-payment";
import { parsePagination, paginated, type PaginatedResult } from "../pagination";
import {
  OUTSTANDING_INVOICE_STATUSES,
  balanceAgeBucketForDays,
  buildReceivablesSummary,
  deriveReceivableDisplayStatus,
  invoiceAgeingDays,
  invoiceBalanceAgeDays,
  type ReceivableBalanceAgeingBucket,
  type ReceivableDisplayStatus,
  type ReportAgeingBuckets,
} from "../receivables";
import { listClientPayments } from "./client-payment.service";

type Decimalish = { toNumber(): number } | number | null | undefined;
const n = (v: Decimalish) => {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
};

export type ReceivablesSortField = "dueDate" | "outstanding" | "issueDate" | "client";
export type ReceivablesSortDir = "asc" | "desc";

export type ReceivableAgeingBucketFilter = ReceivableBalanceAgeingBucket | "overdue";

export function normalizeReceivableAgeingBucketFilter(
  raw?: string
): ReceivableAgeingBucketFilter | undefined {
  if (!raw) return undefined;
  if (raw === "overdue") return "overdue";
  if (raw === "current" || raw === "d1_30") return "d0_30";
  if (["d0_30", "d31_60", "d61_90", "d90plus"].includes(raw)) {
    return raw as ReceivableBalanceAgeingBucket;
  }
  return undefined;
}

export type ReceivablesFilters = {
  clientId?: string;
  status?: ReceivableDisplayStatus;
  ageingBucket?: ReceivableAgeingBucketFilter;
  dueFrom?: Date;
  dueTo?: Date;
  issueFrom?: Date;
  issueTo?: Date;
  tripLr?: string;
  minOutstanding?: number;
  maxOutstanding?: number;
};

export type ReceivableRow = {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | null;
  clientId: string;
  clientName: string;
  tripLr: string;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  daysOverdue: number;
  daysSinceIssue: number;
  ageingBucket: ReceivableBalanceAgeingBucket;
  displayStatus: ReceivableDisplayStatus;
  storedStatus: string;
};

export type ReceivablesSummary = {
  total: number;
  totalOverdue: number;
  buckets: ReportAgeingBuckets;
};

export type ClientReceivableSummary = {
  clientId: string;
  clientName: string;
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  overdue: number;
  invoiceCount: number;
  payments: Awaited<ReturnType<typeof listClientPayments>>;
};

const invoiceInclude = {
  client: { select: { id: true, name: true } },
  lines: {
    select: {
      lrNumber: true,
      trip: { select: { lrNumber: true } },
    },
  },
} satisfies Prisma.ClientInvoiceInclude;

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

export function parseReceivablesFilters(
  searchParams: Record<string, string | string[] | undefined>
): ReceivablesFilters {
  const pick = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const minOutstanding = pick("minOutstanding");
  const maxOutstanding = pick("maxOutstanding");
  const status = pick("status") as ReceivableDisplayStatus | undefined;
  const ageingBucketRaw = pick("ageingBucket");
  const ageingBucket = normalizeReceivableAgeingBucketFilter(ageingBucketRaw);

  return {
    clientId: pick("clientId") || undefined,
    status:
      status && ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(status) ? status : undefined,
    ageingBucket,
    dueFrom: parseDate(pick("dueFrom")),
    dueTo: parseDate(pick("dueTo")),
    issueFrom: parseDate(pick("issueFrom")),
    issueTo: parseDate(pick("issueTo")),
    tripLr: pick("tripLr")?.trim() || undefined,
    minOutstanding: minOutstanding != null && minOutstanding !== "" ? Number(minOutstanding) : undefined,
    maxOutstanding: maxOutstanding != null && maxOutstanding !== "" ? Number(maxOutstanding) : undefined,
  };
}

export function parseReceivablesSort(
  searchParams: Record<string, string | string[] | undefined>
): { sort: ReceivablesSortField; dir: ReceivablesSortDir } {
  const pick = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const sort = pick("sort") as ReceivablesSortField | undefined;
  const dir = pick("dir") as ReceivablesSortDir | undefined;
  const validSort: ReceivablesSortField[] = ["dueDate", "outstanding", "issueDate", "client"];
  return {
    sort: sort && validSort.includes(sort) ? sort : "dueDate",
    dir: dir === "asc" || dir === "desc" ? dir : "asc",
  };
}

export function buildReceivablesPrismaWhere(filters: ReceivablesFilters): Prisma.ClientInvoiceWhereInput {
  const where: Prisma.ClientInvoiceWhereInput = {
    status: { in: [...OUTSTANDING_INVOICE_STATUSES] },
  };

  if (filters.clientId) where.clientId = filters.clientId;

  if (filters.dueFrom || filters.dueTo) {
    where.dueDate = {};
    if (filters.dueFrom) where.dueDate.gte = filters.dueFrom;
    if (filters.dueTo) where.dueDate.lte = endOfDay(filters.dueTo);
  }

  if (filters.issueFrom || filters.issueTo) {
    where.issueDate = {};
    if (filters.issueFrom) where.issueDate.gte = filters.issueFrom;
    if (filters.issueTo) where.issueDate.lte = endOfDay(filters.issueTo);
  }

  if (filters.tripLr) {
    const q = filters.tripLr;
    where.lines = {
      some: {
        OR: [
          { lrNumber: { contains: q, mode: "insensitive" } },
          { trip: { lrNumber: { contains: q, mode: "insensitive" } } },
        ],
      },
    };
  }

  return where;
}

function mapInvoiceToRow(
  inv: Prisma.ClientInvoiceGetPayload<{ include: typeof invoiceInclude }>,
  nowMs = Date.now()
): ReceivableRow | null {
  const totalAmount = n(inv.totalAmount);
  const paidAmount = n(inv.paidAmount);
  const outstanding = invoiceOutstanding(totalAmount, paidAmount);
  if (outstanding <= 0) return null;

  const daysOverdue = Math.max(0, invoiceAgeingDays(inv.dueDate, inv.issueDate, nowMs));
  const daysSinceIssue = invoiceBalanceAgeDays(inv.issueDate, inv.finalizedAt, nowMs);
  const ageingBucket = balanceAgeBucketForDays(daysSinceIssue);
  const displayStatus = deriveReceivableDisplayStatus(
    totalAmount,
    paidAmount,
    inv.dueDate,
    inv.issueDate,
    nowMs
  );

  const lrNumbers = inv.lines
    .map((l) => l.lrNumber ?? l.trip?.lrNumber)
    .filter(Boolean) as string[];

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    clientId: inv.clientId,
    clientName: inv.client.name,
    tripLr: lrNumbers.length > 0 ? lrNumbers.join(", ") : "—",
    totalAmount,
    paidAmount,
    outstanding,
    daysOverdue,
    daysSinceIssue,
    ageingBucket,
    displayStatus,
    storedStatus: inv.status,
  };
}

export function applyReceivableComputedFilters(
  rows: ReceivableRow[],
  filters: ReceivablesFilters
): ReceivableRow[] {
  return rows.filter((row) => {
    if (filters.status && row.displayStatus !== filters.status) return false;
    if (filters.ageingBucket === "overdue") {
      if (row.daysOverdue <= 0) return false;
    } else if (filters.ageingBucket && row.ageingBucket !== filters.ageingBucket) {
      return false;
    }
    if (filters.minOutstanding != null && row.outstanding < filters.minOutstanding) return false;
    if (filters.maxOutstanding != null && row.outstanding > filters.maxOutstanding) return false;
    return true;
  });
}

export function sortReceivableRows(
  rows: ReceivableRow[],
  sort: ReceivablesSortField,
  dir: ReceivablesSortDir
): ReceivableRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "outstanding":
        cmp = a.outstanding - b.outstanding;
        break;
      case "issueDate":
        cmp = a.issueDate.getTime() - b.issueDate.getTime();
        break;
      case "client":
        cmp = a.clientName.localeCompare(b.clientName);
        break;
      case "dueDate":
      default: {
        const aDue = (a.dueDate ?? a.issueDate).getTime();
        const bDue = (b.dueDate ?? b.issueDate).getTime();
        cmp = aDue - bDue;
        break;
      }
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return copy;
}

async function fetchReceivableInvoices(filters: ReceivablesFilters) {
  return prisma.clientInvoice.findMany({
    where: buildReceivablesPrismaWhere(filters),
    include: invoiceInclude,
  });
}

export async function listReceivablesPaginated(
  filters: ReceivablesFilters,
  paginationParams: Record<string, string | string[] | undefined>,
  sortParams: { sort: ReceivablesSortField; dir: ReceivablesSortDir },
  nowMs = Date.now()
): Promise<PaginatedResult<ReceivableRow>> {
  const { skip, take, page, pageSize } = parsePagination(paginationParams);
  const invoices = await fetchReceivableInvoices(filters);

  let rows = invoices
    .map((inv) => mapInvoiceToRow(inv, nowMs))
    .filter((r): r is ReceivableRow => r != null);

  rows = applyReceivableComputedFilters(rows, filters);
  rows = sortReceivableRows(rows, sortParams.sort, sortParams.dir);

  const total = rows.length;
  const items = rows.slice(skip, skip + take);
  return paginated(items, total, page, pageSize);
}

export async function getReceivablesSummary(
  filters: ReceivablesFilters,
  nowMs = Date.now()
): Promise<ReceivablesSummary> {
  const invoices = await fetchReceivableInvoices(filters);

  const ageingInputs = invoices
    .map((inv) => {
      const totalAmount = n(inv.totalAmount);
      const paidAmount = n(inv.paidAmount);
      const outstanding = invoiceOutstanding(totalAmount, paidAmount);
      if (outstanding <= 0) return null;

      const row = mapInvoiceToRow(inv, nowMs);
      if (!row) return null;
      if (filters.status && row.displayStatus !== filters.status) return null;
      if (filters.ageingBucket === "overdue" && row.daysOverdue <= 0) return null;
      if (filters.ageingBucket && filters.ageingBucket !== "overdue" && row.ageingBucket !== filters.ageingBucket) {
        return null;
      }
      if (filters.minOutstanding != null && outstanding < filters.minOutstanding) return null;
      if (filters.maxOutstanding != null && outstanding > filters.maxOutstanding) return null;

      return {
        clientName: inv.client.name,
        invoiceNumber: inv.invoiceNumber,
        totalAmount,
        paidAmount,
        status: inv.status,
        dueDate: inv.dueDate,
        issueDate: inv.issueDate,
        finalizedAt: inv.finalizedAt,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  return buildReceivablesSummary(ageingInputs, nowMs);
}

export async function getClientReceivableSummary(clientId: string): Promise<ClientReceivableSummary | null> {
  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      invoices: {
        where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
        select: { totalAmount: true, paidAmount: true, status: true, dueDate: true, issueDate: true },
      },
    },
  });
  if (!client) return null;

  const nowMs = Date.now();
  let totalInvoiced = 0;
  let totalOutstanding = 0;
  let overdue = 0;
  let invoiceCount = 0;

  for (const inv of client.invoices) {
    const total = n(inv.totalAmount);
    const paid = n(inv.paidAmount);
    const outstanding = invoiceOutstanding(total, paid);
    totalInvoiced += total;
    if (outstanding > 0 && OUTSTANDING_INVOICE_STATUSES.includes(inv.status as typeof OUTSTANDING_INVOICE_STATUSES[number])) {
      totalOutstanding += outstanding;
      invoiceCount += 1;
      if (invoiceAgeingDays(inv.dueDate, inv.issueDate, nowMs) > 0) {
        overdue += outstanding;
      }
    }
  }

  const payments = await listClientPayments({ clientId, limit: 100 });
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);

  return {
    clientId: client.id,
    clientName: client.name,
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    overdue: Math.round(overdue * 100) / 100,
    invoiceCount,
    payments,
  };
}

export async function getReceivablesFilterOptions() {
  const [clients, trips] = await Promise.all([
    prisma.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.trip.findMany({
      where: {
        invoiceLines: {
          some: {
            invoice: { status: { in: [...OUTSTANDING_INVOICE_STATUSES] } },
          },
        },
      },
      select: { lrNumber: true },
      orderBy: { lrNumber: "asc" },
      take: 200,
    }),
  ]);

  return { clients, trips };
}
