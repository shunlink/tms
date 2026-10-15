import { prisma } from "../prisma";
import {
  resolveTripVendorAdvance,
  tripAdvanceSummarySelect,
  type TripAdvanceRequestRow,
} from "../advance";
import { advanceOutstandingAmount, balanceOutstandingAmount } from "../payables";
import { deriveReceivableDisplayStatus, invoiceAgeingDays } from "../receivables";
import { NON_PAYABLE_INVOICE_STATUSES } from "../invoice-payment";
import {
  computeCashMargin,
  computeExpectedMargin,
  computeGrossPayable,
  computeSettlementMargin,
  computeTripCustomerSettlement,
  computeVendorOutstanding,
  resolveAdvanceApproved,
  round2,
} from "../finance-reconciliation";
import {
  computeVendorBalance,
  computeVendorTdsAmount,
  resolveTripAdvanceAmount,
  sumTripCharges,
} from "../vendor-balance";
import { listDocuments } from "./document.service";

export {
  computeAccruedMargin,
  computeCashMargin,
  computeExpectedMargin,
  computeGrossPayable,
  computeVendorOutstanding,
} from "../finance-reconciliation";

type Decimalish = { toNumber(): number } | number | null | undefined;

function n(v: Decimalish): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

export type TripFinancePaymentRow = {
  id: string;
  amount: number;
  paidAt: Date | null;
  paymentMode: string | null;
  referenceNo: string | null;
  status: string | null;
  paymentType: string | null;
  proofUrl: string | null;
  proofFileName: string | null;
};

export type TripFinanceTimelineEvent = {
  id: string;
  type: string;
  label: string;
  timestamp: Date;
  amount: number | null;
  href: string | null;
};

export type TripFinanceDocument = {
  id: string;
  type: string;
  title: string;
  url: string;
  createdAt: Date;
};

export type TripFinanceDto = {
  trip: {
    id: string;
    lrNumber: string;
    status: string;
    routeFrom: string;
    routeTo: string;
    sellRate: number;
    buyRate: number;
    expectedMargin: number;
    expectedMarginPercent: number;
    client: { id: string; name: string };
    vendor: { id: string; name: string } | null;
    indent: { id: string; indentNumber: string } | null;
  };
  commercialSummary: {
    sellRate: number;
    buyRate: number;
    expectedMargin: number;
    expectedMarginPercent: number;
    vendorAdvance: number;
    vendorBalance: number;
    vendorOutstanding: number;
    customerInvoice: number | null;
    customerReceivable: number;
    customerCollected: number;
  };
  financialBreakdown: {
    revenue: { customerSellRate: number };
    vendorCost: {
      baseFreight: number;
      additionalCharges: number;
      deductions: number;
      tds: number;
    };
    vendorSettlement: {
      grossPayable: number;
      advancePaid: number;
      balancePayable: number;
      balancePaid: number;
      vendorOutstanding: number;
    };
    customerSettlement: {
      invoiceAmount: number;
      customerPaid: number;
      customerOutstanding: number;
    };
  };
  vendorSettlement: {
    hasVendor: boolean;
    freight: number;
    additionalCharges: number;
    deductions: number;
    grossPayable: number;
    tdsAmount: number;
    finalPayable: number;
    advanceApproved: number;
    advancePaid: number;
    advanceOutstanding: number;
    balanceAmount: number;
    balancePaid: number;
    balanceOutstanding: number;
    vendorOutstanding: number;
    balanceTaskId: string | null;
    balanceTaskStatus: string | null;
    advanceRequestId: string | null;
    advanceRequestNumber: string | null;
    advanceStatus: string | null;
    paymentHistory: TripFinancePaymentRow[];
  };
  customerSettlement: {
    invoiced: boolean;
    invoiceId: string | null;
    invoiceNumber: string | null;
    invoiceDate: Date | null;
    dueDate: Date | null;
    invoiceStatus: string | null;
    displayStatus: string | null;
    invoiceTotal: number;
    amountCollected: number;
    outstanding: number;
    ageingDays: number | null;
    invoiceTaskId: string | null;
    paymentHistory: TripFinancePaymentRow[];
  };
  profitability: {
    expectedMargin: number;
    expectedMarginPercent: number;
    accruedMargin: number | null;
    accruedMarginAvailable: boolean;
    cashMargin: number;
    marginPercent: number | null;
    customerCollectedPercent: number | null;
    vendorPaidPercent: number | null;
  };
  timeline: TripFinanceTimelineEvent[];
  documents: TripFinanceDocument[];
};

export function buildFinanceTimeline(
  input: {
    advanceRequests: {
      id: string;
      requestNumber: string;
      requestedAt: Date;
      approvedAt: Date | null;
      processedAt: Date | null;
      paymentDate: Date | null;
      paidAmount: number | null;
    }[];
    trip: {
      deliveredAt: Date | null;
      podVerifiedAt: Date | null;
      tripClosedAt: Date | null;
    };
    balanceTask: {
      id: string;
      createdAt: Date;
      approvedAt: Date | null;
      processedAt: Date | null;
      payments: { id: string; amount: number; paidAt: Date }[];
    } | null;
    invoice: {
      id: string;
      invoiceNumber: string;
      createdAt: Date;
      finalizedAt: Date | null;
      issueDate: Date;
    } | null;
    invoiceTask: { id: string; createdAt: Date } | null;
    clientPayments: { id: string; amount: number; paidAt: Date }[];
    vendorPayments: { id: string; amount: number; paidAt: Date | null; paymentType: string }[];
  }
): TripFinanceTimelineEvent[] {
  const events: TripFinanceTimelineEvent[] = [];

  for (const adv of input.advanceRequests) {
    events.push({
      id: `adv-req-${adv.id}`,
      type: "ADVANCE_REQUESTED",
      label: `Advance requested (${adv.requestNumber})`,
      timestamp: adv.requestedAt,
      amount: null,
      href: "/advance-payments",
    });
    if (adv.approvedAt) {
      events.push({
        id: `adv-appr-${adv.id}`,
        type: "ADVANCE_APPROVED",
        label: `Advance approved (${adv.requestNumber})`,
        timestamp: adv.approvedAt,
        amount: null,
        href: "/advance-payments",
      });
    }
    const paidAt = adv.paymentDate ?? adv.processedAt;
    if (paidAt && adv.paidAmount != null && adv.paidAmount > 0) {
      events.push({
        id: `adv-paid-${adv.id}`,
        type: "ADVANCE_PAID",
        label: `Advance paid (${adv.requestNumber})`,
        timestamp: paidAt,
        amount: adv.paidAmount,
        href: "/advance-payments",
      });
    }
  }

  if (input.trip.deliveredAt) {
    events.push({
      id: "trip-delivered",
      type: "TRIP_COMPLETED",
      label: "Trip delivered",
      timestamp: input.trip.deliveredAt,
      amount: null,
      href: null,
    });
  }
  if (input.trip.podVerifiedAt) {
    events.push({
      id: "pod-verified",
      type: "POD_VERIFIED",
      label: "POD verified",
      timestamp: input.trip.podVerifiedAt,
      amount: null,
      href: null,
    });
  }
  if (input.trip.tripClosedAt) {
    events.push({
      id: "trip-closed",
      type: "TRIP_CLOSED",
      label: "Trip closed",
      timestamp: input.trip.tripClosedAt,
      amount: null,
      href: null,
    });
  }

  if (input.balanceTask) {
    events.push({
      id: `bal-created-${input.balanceTask.id}`,
      type: "BALANCE_TASK_CREATED",
      label: "Vendor balance task created",
      timestamp: input.balanceTask.createdAt,
      amount: null,
      href: "/balance-payments",
    });
    if (input.balanceTask.approvedAt) {
      events.push({
        id: `bal-appr-${input.balanceTask.id}`,
        type: "BALANCE_APPROVED",
        label: "Vendor balance approved",
        timestamp: input.balanceTask.approvedAt,
        amount: null,
        href: "/balance-payments",
      });
    }
    for (const p of input.balanceTask.payments) {
      events.push({
        id: `bal-pay-${p.id}`,
        type: "BALANCE_PAYMENT",
        label: "Vendor balance payment",
        timestamp: p.paidAt,
        amount: p.amount,
        href: "/balance-payments",
      });
    }
    if (input.balanceTask.processedAt) {
      events.push({
        id: `bal-proc-${input.balanceTask.id}`,
        type: "BALANCE_PROCESSED",
        label: "Vendor balance processed",
        timestamp: input.balanceTask.processedAt,
        amount: null,
        href: "/balance-payments",
      });
    }
  }

  if (input.invoiceTask) {
    events.push({
      id: `inv-task-${input.invoiceTask.id}`,
      type: "INVOICE_TASK_CREATED",
      label: "Invoice task created",
      timestamp: input.invoiceTask.createdAt,
      amount: null,
      href: "/invoice-tasks",
    });
  }

  if (input.invoice) {
    events.push({
      id: `inv-created-${input.invoice.id}`,
      type: "INVOICE_CREATED",
      label: `Invoice created (${input.invoice.invoiceNumber})`,
      timestamp: input.invoice.createdAt,
      amount: null,
      href: `/invoices/${input.invoice.id}`,
    });
    if (input.invoice.finalizedAt) {
      events.push({
        id: `inv-final-${input.invoice.id}`,
        type: "INVOICE_FINALIZED",
        label: `Invoice finalized (${input.invoice.invoiceNumber})`,
        timestamp: input.invoice.finalizedAt,
        amount: null,
        href: `/invoices/${input.invoice.id}`,
      });
    }
  }

  for (const p of input.clientPayments) {
    events.push({
      id: `cust-pay-${p.id}`,
      type: "CUSTOMER_PAYMENT",
      label: "Customer payment received",
      timestamp: p.paidAt,
      amount: p.amount,
      href: "/client-payments",
    });
  }

  for (const p of input.vendorPayments) {
    if (!p.paidAt) continue;
    events.push({
      id: `vend-pay-${p.id}`,
      type: "VENDOR_PAYMENT",
      label: `Vendor payment (${p.paymentType.toLowerCase()})`,
      timestamp: p.paidAt,
      amount: p.amount,
      href: "/payments",
    });
  }

  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return events;
}

const tripFinanceInclude = {
  client: { select: { id: true, name: true } },
  vendor: { select: { id: true, name: true, commercial: { select: { tdsApplicable: true } } } },
  indent: { select: { id: true, indentNumber: true, advanceStatus: true, advanceApproved: true, advanceRequested: true, payments: { select: { paymentType: true, amount: true } } } },
  charges: { select: { chargeType: true, amount: true } },
  advanceRequests: {
    select: {
      ...tripAdvanceSummarySelect,
      id: true,
      requestedAt: true,
      approvedAt: true,
      voucherGeneratedAt: true,
      voucherFile: { select: { id: true, url: true, fileName: true } },
      paymentProofFile: { select: { id: true, url: true, fileName: true } },
    },
    orderBy: { createdAt: "desc" },
  },
  balancePaymentTask: {
    include: {
      payments: {
        orderBy: { paidAt: "desc" },
        include: { proofFile: { select: { id: true, url: true, fileName: true } } },
      },
      voucherFile: { select: { id: true, url: true, fileName: true } },
    },
  },
  invoiceTask: { select: { id: true, createdAt: true, status: true, invoiceId: true } },
  invoiceLines: {
    include: {
      invoice: {
        include: {
          payments: {
            orderBy: { paidAt: "desc" },
            include: { proofFile: { select: { id: true, url: true, fileName: true } } },
          },
        },
      },
    },
  },
  clientPayments: {
    orderBy: { paidAt: "desc" },
    include: { proofFile: { select: { id: true, url: true, fileName: true } } },
  },
  vendorPayments: {
    orderBy: { createdAt: "desc" },
    include: { proofFile: { select: { id: true, url: true, fileName: true } } },
  },
} as const;

export async function getTripFinance(tripId: string): Promise<TripFinanceDto | null> {
  let trip = await prisma.trip.findFirst({
    where: { id: tripId },
    include: tripFinanceInclude,
  });
  if (!trip) return null;

  if (trip.podVerifiedAt && trip.vendorId) {
    const { ensureBalancePaymentTaskForTrip } = await import("./vendor-balance-payment.service");
    await ensureBalancePaymentTaskForTrip(tripId);
    const refreshed = await prisma.trip.findFirst({
      where: { id: tripId },
      include: tripFinanceInclude,
    });
    if (refreshed) trip = refreshed;
  }

  const sellRate = n(trip.clientRate);
  const buyRate = n(trip.vendorRate);
  const { expectedMargin, expectedMarginPercent } = computeExpectedMargin(sellRate, buyRate);

  const hasVendor = Boolean(trip.vendor);
  const { additionalCharges, deductions } = sumTripCharges(trip.charges);
  const freight = buyRate;

  const balanceTask = trip.balancePaymentTask;
  const tdsApplicable = trip.vendor?.commercial?.tdsApplicable ?? false;

  let grossPayable: number;
  let tdsAmount: number;
  let finalPayable: number;
  let advancePaid: number;
  let advanceApproved: number;
  let advanceOutstanding: number;
  let balanceAmount: number;
  let balancePaid: number;
  let balanceOutstanding: number;
  let vendorSettlementKnown = false;

  const tripAdvance = resolveTripVendorAdvance(trip.advanceRequests as TripAdvanceRequestRow[]);
  const workflowAdvancePaid = resolveTripAdvanceAmount({
    vendorRate: freight,
    advanceRequests: trip.advanceRequests as TripAdvanceRequestRow[],
    indent: trip.indent,
  });

  const manualAdvancePaid = trip.vendorPayments
    .filter((p) => p.paymentType === "ADVANCE" && p.status === "PAID" && p.sourceType === "MANUAL")
    .reduce((s, p) => s + n(p.netPayable), 0);

  advancePaid = round2(workflowAdvancePaid + manualAdvancePaid);

  const liveAdvance = trip.advanceRequests.find(
    (r) => !["REJECTED", "CANCELLED"].includes(r.status)
  );
  advanceApproved = liveAdvance
    ? resolveAdvanceApproved({
        approvedAmount: n(liveAdvance.approvedAmount),
        negotiatedAmount: n(liveAdvance.negotiatedAmount),
        requestedAmount: n(liveAdvance.requestedAmount),
      })
    : tripAdvance?.approvedAmount ?? 0;

  if (
    liveAdvance &&
    ["APPROVED", "VENDOR_ACCEPTED", "PROCESSING", "SLA_BREACHED"].includes(liveAdvance.status)
  ) {
    advanceOutstanding = advanceOutstandingAmount({
      approvedAmount: n(liveAdvance.approvedAmount),
      negotiatedAmount: n(liveAdvance.negotiatedAmount),
      requestedAmount: n(liveAdvance.requestedAmount),
      paidAmount: n(liveAdvance.paidAmount),
    });
  } else {
    advanceOutstanding = 0;
  }

  const { getAuthoritativeTripPayable } = await import("./authoritative-vendor-payable.service");
  const authoritative = await getAuthoritativeTripPayable(tripId);

  if (authoritative?.source === "PAYABLE_RECORD") {
    grossPayable = computeGrossPayable(
      authoritative.freightAmount,
      authoritative.additionalChargesAmount,
      authoritative.deductionsAmount
    );
    tdsAmount = authoritative.tdsAmount;
    finalPayable = authoritative.finalPayableAmount;
    balanceAmount = authoritative.balanceAmount;
    balancePaid = authoritative.balancePaidAmount;
    balanceOutstanding = authoritative.balanceOutstanding;
    vendorSettlementKnown = true;
  } else if (balanceTask) {
    grossPayable = computeGrossPayable(
      n(balanceTask.freightAmount),
      n(balanceTask.additionalChargesAmount),
      n(balanceTask.deductionsAmount)
    );
    tdsAmount = n(balanceTask.tdsAmount);
    finalPayable = n(balanceTask.finalPayableAmount);
    balanceAmount = n(balanceTask.balanceAmount);
    balancePaid = n(balanceTask.paidAmount);
    balanceOutstanding = balanceOutstandingAmount({
      balanceAmount,
      paidAmount: balancePaid,
    });
    vendorSettlementKnown = true;
  } else if (hasVendor) {
    tdsAmount = computeVendorTdsAmount(freight, tdsApplicable);
    const computed = computeVendorBalance({
      vendorRate: freight,
      advanceAmount: advancePaid,
      additionalCharges,
      deductions,
      tdsAmount,
    });
    grossPayable = computeGrossPayable(freight, additionalCharges, deductions);
    finalPayable = computed.finalPayableAmount;
    balanceAmount = computed.balanceAmount;
    balancePaid = 0;
    balanceOutstanding = Math.max(0, balanceAmount);
  } else {
    grossPayable = 0;
    tdsAmount = 0;
    finalPayable = 0;
    balanceAmount = 0;
    balancePaid = 0;
    balanceOutstanding = 0;
  }

  const vendorOutstanding = computeVendorOutstanding(advanceOutstanding, balanceOutstanding);

  const invoiceLine = trip.invoiceLines[0];
  const invoice = invoiceLine?.invoice ?? null;
  const invoiceFinalized = Boolean(invoice?.finalizedAt);
  const invoiceIsPayable =
    invoice != null && !NON_PAYABLE_INVOICE_STATUSES.includes(invoice.status);

  const lineAmount = invoiceLine ? n(invoiceLine.amount) : null;
  const invoiceTotal = invoice ? n(invoice.totalAmount) : null;
  const tripCustomer = computeTripCustomerSettlement({
    lineAmount,
    invoiceTotal,
    invoicePaid: invoice ? n(invoice.paidAmount) : null,
    invoicePayable: invoiceIsPayable,
    tripClientPayments: trip.clientPayments.reduce((s, p) => s + n(p.amount), 0),
  });
  const tripInvoiceAmount = tripCustomer.invoiceAmount;
  const amountCollected = tripCustomer.collected;
  const customerOutstanding = tripCustomer.outstanding;

  const displayStatus =
    invoice && invoiceIsPayable && invoiceTotal != null
      ? deriveReceivableDisplayStatus(
          invoiceTotal,
          n(invoice.paidAmount),
          invoice.dueDate,
          invoice.issueDate
        )
      : null;

  const ageingDays =
    invoice && invoiceIsPayable
      ? invoiceAgeingDays(invoice.dueDate, invoice.issueDate)
      : null;

  const vendorPaidCash = trip.vendorPayments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + n(p.netPayable), 0);

  const cashMargin = computeCashMargin(amountCollected, vendorPaidCash);
  const accruedMargin = computeSettlementMargin(
    invoiceIsPayable ? tripInvoiceAmount : null,
    finalPayable,
    invoiceFinalized,
    vendorSettlementKnown
  );

  const vendorPaidPercent =
    finalPayable > 0 ? round2((advancePaid + balancePaid) / finalPayable * 100) : null;
  const customerCollectedPercent =
    tripInvoiceAmount > 0 && invoiceIsPayable
      ? round2((amountCollected / tripInvoiceAmount) * 100)
      : null;
  const marginPercent =
    sellRate > 0 && accruedMargin != null
      ? round2((accruedMargin / sellRate) * 100)
      : expectedMarginPercent;

  const ledgerBalanceSourceIds = new Set(
    trip.vendorPayments
      .filter((p) => p.sourceType === "BALANCE_PAYMENT" && p.sourceId)
      .map((p) => p.sourceId as string)
  );

  const vendorPaymentHistory: TripFinancePaymentRow[] = [
    ...trip.vendorPayments.map((p) => ({
      id: p.id,
      amount: n(p.netPayable),
      paidAt: p.paidAt,
      paymentMode: p.paymentMode,
      referenceNo: p.referenceNo,
      status: p.status,
      paymentType: p.paymentType,
      proofUrl: p.proofFile?.url ?? null,
      proofFileName: p.proofFile?.fileName ?? null,
    })),
    ...(balanceTask?.payments
      .filter((p) => !ledgerBalanceSourceIds.has(`balance:${p.id}`))
      .map((p) => ({
        id: p.id,
        amount: n(p.amount),
        paidAt: p.paidAt,
        paymentMode: p.paymentMode,
        referenceNo: p.utrReference,
        status: "PAID",
        paymentType: "BALANCE",
        proofUrl: p.proofFile?.url ?? null,
        proofFileName: p.proofFile?.fileName ?? null,
      })) ?? []),
  ].sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0));

  const customerPaymentHistory: TripFinancePaymentRow[] = invoice?.payments.length
    ? invoice.payments.map((p) => ({
        id: p.id,
        amount: n(p.amount),
        paidAt: p.paidAt,
        paymentMode: p.paymentMode,
        referenceNo: p.referenceNo,
        status: "PAID",
        paymentType: "INVOICE",
        proofUrl: p.proofFile?.url ?? null,
        proofFileName: p.proofFile?.fileName ?? null,
      }))
    : trip.clientPayments.map((p) => ({
        id: p.id,
        amount: n(p.amount),
        paidAt: p.paidAt,
        paymentMode: p.paymentMode,
        referenceNo: p.referenceNo,
        status: "PAID",
        paymentType: "TRIP",
        proofUrl: p.proofFile?.url ?? null,
        proofFileName: p.proofFile?.fileName ?? null,
      }));

  const timeline = buildFinanceTimeline({
    advanceRequests: trip.advanceRequests.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber ?? "",
      requestedAt: r.requestedAt ?? r.createdAt ?? new Date(),
      approvedAt: r.approvedAt,
      processedAt: r.processedAt,
      paymentDate: r.paymentDate,
      paidAmount: n(r.paidAmount),
    })),
    trip: {
      deliveredAt: trip.deliveredAt,
      podVerifiedAt: trip.podVerifiedAt,
      tripClosedAt: trip.tripClosedAt,
    },
    balanceTask: balanceTask
      ? {
          id: balanceTask.id,
          createdAt: balanceTask.createdAt,
          approvedAt: balanceTask.approvedAt,
          processedAt: balanceTask.processedAt,
          payments: balanceTask.payments.map((p) => ({
            id: p.id,
            amount: n(p.amount),
            paidAt: p.paidAt,
          })),
        }
      : null,
    invoice: invoice
      ? {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          createdAt: invoice.createdAt,
          finalizedAt: invoice.finalizedAt,
          issueDate: invoice.issueDate,
        }
      : null,
    invoiceTask: trip.invoiceTask
      ? { id: trip.invoiceTask.id, createdAt: trip.invoiceTask.createdAt }
      : null,
    clientPayments: customerPaymentHistory.map((p) => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt!,
    })),
    vendorPayments: trip.vendorPayments
      .filter((p) => p.status === "PAID" && p.paidAt)
      .map((p) => ({
        id: p.id,
        amount: n(p.netPayable),
        paidAt: p.paidAt,
        paymentType: p.paymentType,
      })),
  });

  const tripDocs = await listDocuments("TRIP", tripId);
  const documents: TripFinanceDocument[] = tripDocs.map((d) => ({
    id: d.id,
    type: d.type,
    title: d.name ?? d.type,
    url: d.url,
    createdAt: d.createdAt,
  }));

  for (const adv of trip.advanceRequests) {
    if (adv.voucherFile) {
      documents.push({
        id: adv.voucherFile.id,
        type: "ADVANCE_VOUCHER",
        title: `Advance voucher ${adv.requestNumber ?? ""}`.trim(),
        url: adv.voucherFile.url,
        createdAt: adv.voucherGeneratedAt ?? adv.processedAt ?? new Date(),
      });
    }
    if (adv.paymentProofFile) {
      documents.push({
        id: adv.paymentProofFile.id,
        type: "PAYMENT_PROOF",
        title: `Advance payment proof ${adv.requestNumber ?? ""}`.trim(),
        url: adv.paymentProofFile.url,
        createdAt: adv.paymentDate ?? adv.processedAt ?? new Date(),
      });
    }
  }

  if (balanceTask?.voucherFile) {
    documents.push({
      id: balanceTask.voucherFile.id,
      type: "BALANCE_VOUCHER",
      title: `Balance voucher ${balanceTask.voucherNumber ?? ""}`.trim(),
      url: balanceTask.voucherFile.url,
      createdAt: balanceTask.processedAt ?? balanceTask.createdAt,
    });
  }

  if (invoice) {
    documents.push({
      id: invoice.id,
      type: "CUSTOMER_INVOICE",
      title: `Customer invoice ${invoice.invoiceNumber}`,
      url: `/invoices/${invoice.id}`,
      createdAt: invoice.issueDate,
    });
  }

  documents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    trip: {
      id: trip.id,
      lrNumber: trip.lrNumber,
      status: trip.status,
      routeFrom: trip.routeFrom,
      routeTo: trip.routeTo,
      sellRate,
      buyRate,
      expectedMargin,
      expectedMarginPercent,
      client: trip.client,
      vendor: trip.vendor ? { id: trip.vendor.id, name: trip.vendor.name } : null,
      indent: trip.indent
        ? { id: trip.indent.id, indentNumber: trip.indent.indentNumber }
        : null,
    },
    commercialSummary: {
      sellRate,
      buyRate,
      expectedMargin,
      expectedMarginPercent,
      vendorAdvance: advancePaid,
      vendorBalance: balanceAmount,
      vendorOutstanding,
      customerInvoice: invoice && invoiceIsPayable ? tripInvoiceAmount : null,
      customerReceivable: customerOutstanding,
      customerCollected: amountCollected,
    },
    financialBreakdown: {
      revenue: { customerSellRate: sellRate },
      vendorCost: {
        baseFreight: freight,
        additionalCharges,
        deductions,
        tds: tdsAmount,
      },
      vendorSettlement: {
        grossPayable,
        advancePaid,
        balancePayable: balanceAmount,
        balancePaid,
        vendorOutstanding,
      },
      customerSettlement: {
        invoiceAmount: invoiceIsPayable ? tripInvoiceAmount : 0,
        customerPaid: amountCollected,
        customerOutstanding,
      },
    },
    vendorSettlement: {
      hasVendor,
      freight,
      additionalCharges,
      deductions,
      grossPayable,
      tdsAmount,
      finalPayable,
      advanceApproved,
      advancePaid,
      advanceOutstanding,
      balanceAmount,
      balancePaid,
      balanceOutstanding,
      vendorOutstanding,
      balanceTaskId: balanceTask?.id ?? null,
      balanceTaskStatus: balanceTask?.status ?? null,
      advanceRequestId: liveAdvance?.id ?? null,
      advanceRequestNumber: liveAdvance?.requestNumber ?? null,
      advanceStatus: liveAdvance?.status ?? tripAdvance?.status ?? null,
      paymentHistory: vendorPaymentHistory,
    },
    customerSettlement: {
      invoiced: Boolean(invoice),
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      invoiceDate: invoice?.issueDate ?? null,
      dueDate: invoice?.dueDate ?? null,
      invoiceStatus: invoice?.status ?? null,
      displayStatus,
      invoiceTotal: invoiceIsPayable ? tripInvoiceAmount : 0,
      amountCollected: invoiceIsPayable ? amountCollected : 0,
      outstanding: customerOutstanding,
      ageingDays,
      invoiceTaskId: trip.invoiceTask?.id ?? null,
      paymentHistory: customerPaymentHistory,
    },
    profitability: {
      expectedMargin,
      expectedMarginPercent,
      accruedMargin,
      accruedMarginAvailable: accruedMargin != null,
      cashMargin,
      marginPercent,
      customerCollectedPercent,
      vendorPaidPercent,
    },
    timeline,
    documents,
  };
}

/** Serialize trip finance for API responses (dates to ISO strings). */
export function serializeTripFinance(dto: TripFinanceDto) {
  return {
    ...dto,
    timeline: dto.timeline.map((e) => ({
      ...e,
      timestamp: e.timestamp.toISOString(),
    })),
    documents: dto.documents.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
    customerSettlement: {
      ...dto.customerSettlement,
      invoiceDate: dto.customerSettlement.invoiceDate?.toISOString() ?? null,
      dueDate: dto.customerSettlement.dueDate?.toISOString() ?? null,
      paymentHistory: dto.customerSettlement.paymentHistory.map((p) => ({
        ...p,
        paidAt: p.paidAt?.toISOString() ?? null,
      })),
    },
    vendorSettlement: {
      ...dto.vendorSettlement,
      paymentHistory: dto.vendorSettlement.paymentHistory.map((p) => ({
        ...p,
        paidAt: p.paidAt?.toISOString() ?? null,
      })),
    },
  };
}
