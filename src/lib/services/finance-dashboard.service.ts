import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  buildOutstandingAgeing,
  OUTSTANDING_INVOICE_STATUSES,
  splitDetailedAgeingBuckets,
  type DetailedAgeingBuckets,
} from "../receivables";
import { computeMargin } from "../logic";
import { computeCashMargin, computeTripCustomerSettlement } from "../finance-reconciliation";
import { sumTripCharges } from "../vendor-balance";
import { NON_PAYABLE_INVOICE_STATUSES } from "../invoice-payment";
import { sumOutstandingVendorPayables } from "./vendor-payables.service";
import { ACTIVE_BALANCE_PAYMENT_STATUSES } from "../balance-payment-states";
import { managedAdvanceSourceFilter } from "../constants";
import { workQueueWhere } from "./work-queues.service";

type Decimalish = { toNumber(): number } | number | null | undefined;
const n = (v: Decimalish) => {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
};

const COMMITTED_ADVANCE_STATUSES = ["APPROVED", "VENDOR_ACCEPTED", "PROCESSING"];

export type FinanceMetricKind = "BOOKING" | "ACCRUAL" | "CASH" | "OUTSTANDING";

export type FinanceDashboardFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  clientId?: string;
  vendorId?: string;
  tripId?: string;
  status?: string;
};

export type { DetailedAgeingBuckets };

export type FinanceSummaryMetric = {
  key: string;
  label: string;
  amount: number;
  kind: FinanceMetricKind;
  href?: string;
};

export type PaymentQueueMetric = {
  key: string;
  label: string;
  count: number;
  amount: number;
  href: string;
};

export type RecentTransaction = {
  id: string;
  type: "CLIENT_PAYMENT" | "VENDOR_ADVANCE" | "VENDOR_BALANCE" | "INVOICE";
  label: string;
  party: string;
  amount: number;
  currency: string;
  status: string;
  occurredAt: Date;
  href: string;
};

export type TripProfitabilityRow = {
  tripId: string;
  lrNumber: string;
  client: string;
  vendor: string;
  status: string;
  revenue: number;
  vendorCost: number;
  charges: number;
  tds: number;
  expectedMargin: number;
  actualMargin: number | null;
  href: string;
};

export type FinanceDashboardMetrics = {
  summary: FinanceSummaryMetric[];
  receivables: {
    total: number;
    buckets: DetailedAgeingBuckets;
    href: string;
  };
  payables: {
    totalOutstanding: number;
    advancesOutstanding: number;
    balancePending: number;
    overdueSettlement: number;
    tdsWithheld: number;
    href: string;
  };
  paymentQueues: PaymentQueueMetric[];
  recentTransactions: RecentTransaction[];
  tripProfitability: TripProfitabilityRow[];
  filterOptions: {
    clients: { id: string; name: string }[];
    vendors: { id: string; name: string }[];
    trips: { id: string; lrNumber: string }[];
  };
};

function tripScope(filters: FinanceDashboardFilters): Prisma.TripWhereInput {
  const where: Prisma.TripWhereInput = {};
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.vendorId) where.vendorId = filters.vendorId;
  if (filters.tripId) where.id = filters.tripId;
  if (filters.status) where.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  return where;
}

function invoiceScope(filters: FinanceDashboardFilters): Prisma.ClientInvoiceWhereInput {
  const where: Prisma.ClientInvoiceWhereInput = {
    status: { in: [...OUTSTANDING_INVOICE_STATUSES] },
  };
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.tripId) {
    where.lines = { some: { tripId: filters.tripId } };
  }
  if (filters.vendorId) {
    where.lines = { some: { trip: { vendorId: filters.vendorId } } };
  }
  return where;
}

function vendorScope(filters: FinanceDashboardFilters): { vendorId?: string; tripId?: string } {
  return {
    vendorId: filters.vendorId,
    tripId: filters.tripId,
  };
}

function advanceCommittedAmount(a: {
  approvedAmount?: Decimalish;
  negotiatedAmount?: Decimalish;
  requestedAmount?: Decimalish;
  paidAmount?: Decimalish;
}) {
  const approved = n(a.approvedAmount ?? a.negotiatedAmount ?? a.requestedAmount);
  const paid = n(a.paidAmount);
  return Math.max(0, approved - paid);
}

function resolveAdvanceQueueAmount(a: {
  approvedAmount?: Decimalish;
  negotiatedAmount?: Decimalish;
  requestedAmount?: Decimalish;
}) {
  return n(a.approvedAmount ?? a.negotiatedAmount ?? a.requestedAmount);
}

async function fetchPayablesBreakdown(filters: FinanceDashboardFilters) {
  const scope = vendorScope(filters);
  const vendorWhere = scope.vendorId ? { vendorId: scope.vendorId } : {};
  const tripWhere = scope.tripId ? { tripId: scope.tripId } : {};

  const [balanceTasks, advances, ledger, tdsPaid] = await Promise.all([
    prisma.vendorBalancePaymentTask.findMany({
      where: {
        ...vendorWhere,
        ...tripWhere,
        status: { in: ACTIVE_BALANCE_PAYMENT_STATUSES },
      },
      select: {
        balanceAmount: true,
        paidAmount: true,
        tdsAmount: true,
        deadlineAt: true,
        status: true,
      },
    }),
    prisma.advanceRequest.findMany({
      where: {
        ...vendorWhere,
        ...tripWhere,
        ...managedAdvanceSourceFilter(),
        status: { in: COMMITTED_ADVANCE_STATUSES },
      },
      select: {
        approvedAmount: true,
        negotiatedAmount: true,
        requestedAmount: true,
        paidAmount: true,
      },
    }),
    prisma.vendorPayment.aggregate({
      where: {
        ...vendorWhere,
        ...tripWhere,
        status: { in: ["PENDING", "APPROVED"] },
      },
      _sum: { netPayable: true },
    }),
    prisma.vendorPayment.aggregate({
      where: {
        ...vendorWhere,
        ...tripWhere,
        status: "PAID",
      },
      _sum: { tdsAmount: true },
    }),
  ]);

  const balancePending = balanceTasks.reduce(
    (s, t) => s + Math.max(0, n(t.balanceAmount) - n(t.paidAmount)),
    0
  );
  const advancesOutstanding = advances.reduce((s, a) => s + advanceCommittedAmount(a), 0);
  const pendingLedger = n(ledger._sum.netPayable);
  const totalOutstanding = sumOutstandingVendorPayables({
    balanceTasks,
    advances,
    pendingLedgerTotal: pendingLedger,
  });
  const now = Date.now();
  const overdueSettlement = balanceTasks.reduce((s, t) => {
    const outstanding = Math.max(0, n(t.balanceAmount) - n(t.paidAmount));
    if (outstanding <= 0) return s;
    if (t.deadlineAt.getTime() < now || t.status === "SLA_BREACHED") return s + outstanding;
    return s;
  }, 0);
  const tdsOnOpenTasks = balanceTasks.reduce((s, t) => {
    const outstanding = Math.max(0, n(t.balanceAmount) - n(t.paidAmount));
    if (outstanding <= 0) return s;
    return s + n(t.tdsAmount);
  }, 0);

  return {
    totalOutstanding,
    advancesOutstanding: Math.round(advancesOutstanding * 100) / 100,
    balancePending: Math.round(balancePending * 100) / 100,
    overdueSettlement: Math.round(overdueSettlement * 100) / 100,
    tdsWithheld: Math.round((n(tdsPaid._sum.tdsAmount) + tdsOnOpenTasks) * 100) / 100,
  };
}

export async function getFinanceDashboardMetrics(
  filters: FinanceDashboardFilters = {}
): Promise<FinanceDashboardMetrics> {
  const tripWhere = tripScope(filters);
  const hasTripScope = Object.keys(tripWhere).length > 0;

  const paidAtRange: Prisma.DateTimeFilter | undefined =
    filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
          ...(filters.dateTo
            ? {
                lte: (() => {
                  const end = new Date(filters.dateTo!);
                  end.setHours(23, 59, 59, 999);
                  return end;
                })(),
              }
            : {}),
        }
      : undefined;

  const [
    tripAgg,
    invoices,
    clientPaymentsAgg,
    vendorPaidAgg,
    advanceOutstandingAgg,
    payables,
    advanceQueue,
    balanceQueue,
    invoiceTaskCount,
    clientPaymentsMissingProof,
    recentClientPayments,
    recentAdvances,
    recentBalancePayments,
    recentInvoices,
    profitabilityTrips,
    filterClients,
    filterVendors,
    filterTrips,
  ] = await Promise.all([
    prisma.trip.aggregate({
      where: tripWhere,
      _sum: { clientRate: true, vendorRate: true },
    }),
    prisma.clientInvoice.findMany({
      where: invoiceScope(filters),
      include: { client: { select: { name: true } } },
    }),
    prisma.clientPayment.aggregate({
      where: {
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
        ...(paidAtRange ? { paidAt: paidAtRange } : {}),
        ...(filters.vendorId
          ? { trip: { vendorId: filters.vendorId } }
          : hasTripScope
            ? { trip: tripWhere }
            : {}),
      },
      _sum: { amount: true },
    }),
    prisma.vendorPayment.aggregate({
      where: {
        status: "PAID",
        ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
        ...(paidAtRange ? { paidAt: paidAtRange } : {}),
        ...(hasTripScope && !filters.tripId ? { trip: tripWhere } : {}),
      },
      _sum: { netPayable: true, tdsAmount: true },
    }),
    prisma.advanceRequest.findMany({
      where: {
        ...managedAdvanceSourceFilter(),
        status: { in: COMMITTED_ADVANCE_STATUSES },
        ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
        ...(hasTripScope && !filters.tripId ? { trip: tripWhere } : {}),
      },
      select: {
        approvedAmount: true,
        negotiatedAmount: true,
        requestedAmount: true,
        paidAmount: true,
      },
    }),
    fetchPayablesBreakdown(filters),
    prisma.advanceRequest.findMany({
      where: {
        ...workQueueWhere.financeAdvances,
        ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
      },
      select: {
        approvedAmount: true,
        negotiatedAmount: true,
        requestedAmount: true,
      },
    }),
    prisma.vendorBalancePaymentTask.findMany({
      where: {
        ...workQueueWhere.balancePayments,
        ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
      },
      select: { balanceAmount: true, paidAmount: true },
    }),
    prisma.invoiceTask.count({
      where: {
        ...workQueueWhere.invoiceTasks,
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
        ...(filters.clientId ? { trip: { clientId: filters.clientId } } : {}),
        ...(filters.vendorId ? { trip: { vendorId: filters.vendorId } } : {}),
      },
    }),
    prisma.clientPayment.findMany({
      where: {
        ...workQueueWhere.clientPaymentsMissingProof,
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
      },
      select: { amount: true },
    }),
    prisma.clientPayment.findMany({
      where: {
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
        ...(filters.vendorId ? { trip: { vendorId: filters.vendorId } } : {}),
      },
      orderBy: { paidAt: "desc" },
      take: 5,
      include: { client: { select: { name: true } } },
    }),
    prisma.advanceRequest.findMany({
      where: {
        ...managedAdvanceSourceFilter(),
        status: { in: ["PROCESSED", "PROCESSING", "APPROVED", "VENDOR_ACCEPTED"] },
        ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        vendor: { select: { name: true } },
        trip: { select: { lrNumber: true } },
      },
    }),
    prisma.vendorBalancePayment.findMany({
      where: {
        ...(filters.tripId ? { task: { tripId: filters.tripId } } : {}),
        ...(filters.vendorId ? { task: { vendorId: filters.vendorId } } : {}),
      },
      orderBy: { paidAt: "desc" },
      take: 5,
      include: {
        task: {
          select: {
            vendor: { select: { name: true } },
            trip: { select: { lrNumber: true, id: true } },
          },
        },
      },
    }),
    prisma.clientInvoice.findMany({
      where: {
        status: { not: "CANCELLED" },
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.tripId ? { lines: { some: { tripId: filters.tripId } } } : {}),
        ...(filters.vendorId ? { lines: { some: { trip: { vendorId: filters.vendorId } } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { name: true } } },
    }),
    prisma.trip.findMany({
      where: {
        status: { in: ["DELIVERED", "POD_RECEIVED", "INVOICED", "CLOSED"] },
        ...tripWhere,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        client: { select: { name: true } },
        vendor: { select: { name: true } },
        charges: { select: { chargeType: true, amount: true } },
        balancePaymentTask: { select: { tdsAmount: true } },
        clientPayments: { select: { amount: true } },
        invoiceLines: {
          select: {
            amount: true,
            invoice: { select: { totalAmount: true, paidAmount: true, status: true } },
          },
        },
        vendorPayments: {
          where: { status: "PAID" },
          select: { netPayable: true },
        },
      },
    }),
    prisma.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true },
    }),
    prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, lrNumber: true },
    }),
  ]);

  const ageing = buildOutstandingAgeing(
    invoices.map((inv) => ({
      clientName: inv.client.name,
      invoiceNumber: inv.invoiceNumber,
      totalAmount: n(inv.totalAmount),
      paidAmount: n(inv.paidAmount),
      status: inv.status,
      dueDate: inv.dueDate,
      issueDate: inv.issueDate,
    }))
  );
  const receivableBuckets = splitDetailedAgeingBuckets(ageing.rows);

  const totalRevenue = n(tripAgg._sum.clientRate);
  const expectedMargin =
    Math.round((n(tripAgg._sum.clientRate) - n(tripAgg._sum.vendorRate)) * 100) / 100;
  const customerReceivables = ageing.total;
  const customerCollected = n(clientPaymentsAgg._sum.amount);
  const vendorPaid = n(vendorPaidAgg._sum.netPayable);
  const vendorAdvancesOutstanding = advanceOutstandingAgg.reduce(
    (s, a) => s + advanceCommittedAmount(a),
    0
  );

  const summary: FinanceSummaryMetric[] = [
    {
      key: "revenue",
      label: "Total Revenue",
      amount: totalRevenue,
      kind: "BOOKING",
      href: "/trips",
    },
    {
      key: "receivables",
      label: "Customer Receivables",
      amount: customerReceivables,
      kind: "OUTSTANDING",
      href: "/receivables",
    },
    {
      key: "collected",
      label: "Customer Collected",
      amount: customerCollected,
      kind: "CASH",
      href: "/client-payments",
    },
    {
      key: "payables",
      label: "Vendor Payables",
      amount: payables.totalOutstanding,
      kind: "OUTSTANDING",
      href: "/payments",
    },
    {
      key: "vendor-paid",
      label: "Vendor Paid",
      amount: vendorPaid,
      kind: "CASH",
      href: "/payments",
    },
    {
      key: "advances-outstanding",
      label: "Vendor Advances Outstanding",
      amount: Math.round(vendorAdvancesOutstanding * 100) / 100,
      kind: "OUTSTANDING",
      href: "/advance-payments",
    },
    {
      key: "tds",
      label: "TDS Withheld",
      amount: payables.tdsWithheld,
      kind: "ACCRUAL",
      href: "/payments",
    },
    {
      key: "margin",
      label: "Expected Margin",
      amount: expectedMargin,
      kind: "BOOKING",
      href: "/reports",
    },
  ];

  const advanceQueueTotal = advanceQueue.reduce((s, a) => s + resolveAdvanceQueueAmount(a), 0);
  const balanceQueueAmount = balanceQueue.reduce(
    (s, t) => s + Math.max(0, n(t.balanceAmount) - n(t.paidAmount)),
    0
  );
  const missingProofAmount = clientPaymentsMissingProof.reduce((s, p) => s + n(p.amount), 0);

  const paymentQueues: PaymentQueueMetric[] = [
    {
      key: "advances",
      label: "Advance requests awaiting action",
      count: advanceQueue.length,
      amount: Math.round(advanceQueueTotal * 100) / 100,
      href: "/advance-payments",
    },
    {
      key: "balance",
      label: "Balance payments awaiting action",
      count: balanceQueue.length,
      amount: Math.round(balanceQueueAmount * 100) / 100,
      href: "/balance-payments",
    },
    {
      key: "invoices",
      label: "Invoice tasks awaiting action",
      count: invoiceTaskCount,
      amount: 0,
      href: "/invoices",
    },
    {
      key: "client-proof",
      label: "Client payments missing proof",
      count: clientPaymentsMissingProof.length,
      amount: Math.round(missingProofAmount * 100) / 100,
      href: "/client-payments",
    },
  ];

  const recentTransactions: RecentTransaction[] = [
    ...recentClientPayments.map((p) => ({
      id: p.id,
      type: "CLIENT_PAYMENT" as const,
      label: p.paymentType === "ADVANCE" ? "Client advance" : "Client payment",
      party: p.client.name,
      amount: n(p.amount),
      currency: p.currency,
      status: "RECORDED",
      occurredAt: p.paidAt,
      href: "/client-payments",
    })),
    ...recentAdvances.map((a) => ({
      id: a.id,
      type: "VENDOR_ADVANCE" as const,
      label: `Advance ${a.trip.lrNumber}`,
      party: a.vendor.name,
      amount: resolveAdvanceQueueAmount(a),
      currency: a.currency,
      status: a.status,
      occurredAt: a.updatedAt,
      href: "/advance-payments",
    })),
    ...recentBalancePayments.map((p) => ({
      id: p.id,
      type: "VENDOR_BALANCE" as const,
      label: `Balance ${p.task.trip.lrNumber}`,
      party: p.task.vendor.name,
      amount: n(p.amount),
      currency: "INR",
      status: "PAID",
      occurredAt: p.paidAt,
      href: `/balance-payments`,
    })),
    ...recentInvoices.map((inv) => ({
      id: inv.id,
      type: "INVOICE" as const,
      label: inv.invoiceNumber,
      party: inv.client.name,
      amount: n(inv.totalAmount),
      currency: inv.currency,
      status: inv.status,
      occurredAt: inv.createdAt,
      href: `/invoices/${inv.id}`,
    })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 12);

  const tripProfitability: TripProfitabilityRow[] = profitabilityTrips.map((trip) => {
    const { additionalCharges, deductions } = sumTripCharges(trip.charges);
    const charges = additionalCharges - deductions;
    const revenue = n(trip.clientRate);
    const vendorCost = n(trip.vendorRate);
    const tds = n(trip.balancePaymentTask?.tdsAmount);
    const expectedMargin = computeMargin(revenue, vendorCost);
    const invoiceLine = trip.invoiceLines[0];
    const invoice = invoiceLine?.invoice ?? null;
    const invoicePayable =
      invoice != null && !NON_PAYABLE_INVOICE_STATUSES.includes(invoice.status);
    const tripCustomer = computeTripCustomerSettlement({
      lineAmount: invoiceLine ? n(invoiceLine.amount) : null,
      invoiceTotal: invoice ? n(invoice.totalAmount) : null,
      invoicePaid: invoice ? n(invoice.paidAmount) : null,
      invoicePayable,
      tripClientPayments: trip.clientPayments.reduce((s, p) => s + n(p.amount), 0),
    });
    const clientReceived = tripCustomer.collected;
    const vendorPaidTrip = trip.vendorPayments.reduce((s, p) => s + n(p.netPayable), 0);
    const actualMargin =
      clientReceived > 0 || vendorPaidTrip > 0
        ? computeCashMargin(clientReceived, vendorPaidTrip)
        : null;

    return {
      tripId: trip.id,
      lrNumber: trip.lrNumber,
      client: trip.client.name,
      vendor: trip.vendor?.name ?? "—",
      status: trip.status,
      revenue,
      vendorCost,
      charges,
      tds,
      expectedMargin,
      actualMargin,
      href: `/finance/trips/${trip.id}`,
    };
  });

  return {
    summary,
    receivables: {
      total: ageing.total,
      buckets: receivableBuckets,
      href: "/receivables",
    },
    payables: {
      ...payables,
      href: "/payables",
    },
    paymentQueues,
    recentTransactions,
    tripProfitability,
    filterOptions: {
      clients: filterClients,
      vendors: filterVendors,
      trips: filterTrips,
    },
  };
}

export function parseFinanceDashboardFilters(
  params: Record<string, string | string[] | undefined>
): FinanceDashboardFilters {
  const pick = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const dateFrom = pick("from");
  const dateTo = pick("to");
  return {
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    clientId: pick("clientId"),
    vendorId: pick("vendorId"),
    tripId: pick("tripId"),
    status: pick("status"),
  };
}
