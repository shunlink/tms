import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { ACTIVE_BALANCE_PAYMENT_STATUSES } from "../balance-payment-states";
import { managedAdvanceSourceFilter } from "../constants";

/**
 * Canonical actionable work queues. Dashboards, pending-task lists and sidebar badges
 * must all count through these definitions so the numbers can never disagree.
 * A record leaves a queue only when its business state changes — never on page view.
 */

/** Advance requests waiting on Finance (NEGOTIATED waits on the vendor). */
export const FINANCE_ADVANCE_QUEUE_STATUSES = [
  "PENDING_REVIEW",
  "VENDOR_ACCEPTED",
  "APPROVED",
  "PROCESSING",
  "SLA_BREACHED",
];

/** Indent statuses where the internal team must take the next step. */
export const INDENT_ACTION_STATUSES = [
  "DRAFT",
  "WAITING_FOR_ADVANCE",
  "ADVANCE_PAID",
  "RELEASED_TO_VENDORS",
  "QUOTING",
];

const NOT_CANCELLED_INDENT: Prisma.IndentPodWhereInput = {
  indent: { status: { not: "CANCELLED" } },
};

export const workQueueWhere = {
  financeAdvances: {
    ...managedAdvanceSourceFilter(),
    status: { in: FINANCE_ADVANCE_QUEUE_STATUSES },
  } satisfies Prisma.AdvanceRequestWhereInput,

  /** Advance requests awaiting an approve / negotiate / reject decision. */
  advanceApprovals: {
    ...managedAdvanceSourceFilter(),
    status: "PENDING_REVIEW",
  } satisfies Prisma.AdvanceRequestWhereInput,

  /** Trips awaiting first invoice draft — exclude tasks already linked to a draft invoice. */
  invoiceTasks: {
    status: { in: ["PENDING", "SLA_BREACHED"] },
    NOT: { invoice: { status: "DRAFT" } },
  } satisfies Prisma.InvoiceTaskWhereInput,

  draftInvoices: { status: "DRAFT" } satisfies Prisma.ClientInvoiceWhereInput,

  balancePayments: {
    status: { in: ACTIVE_BALANCE_PAYMENT_STATUSES },
  } satisfies Prisma.VendorBalancePaymentTaskWhereInput,

  vendorLedgerPending: {
    status: { in: ["PENDING", "APPROVED"] },
  } satisfies Prisma.VendorPaymentWhereInput,

  clientPaymentsMissingProof: { proofFileId: null } satisfies Prisma.ClientPaymentWhereInput,

  podVerification: {
    status: "PENDING_VERIFICATION",
    ...NOT_CANCELLED_INDENT,
  } satisfies Prisma.IndentPodWhereInput,

  openBadPods: {
    status: "BAD_POD",
    resolutionStatus: { in: ["PENDING", "SLA_BREACHED"] },
    ...NOT_CANCELLED_INDENT,
  } satisfies Prisma.IndentPodWhereInput,

  podEscalations: {
    status: "BAD_POD",
    resolutionStatus: "SLA_BREACHED",
    ...NOT_CANCELLED_INDENT,
  } satisfies Prisma.IndentPodWhereInput,

  placement: {
    vendorId: { not: null },
    placementStatus: { in: ["PLACEMENT_PENDING", "PLACEMENT_FAILED"] },
    status: { notIn: ["CANCELLED", "COMPLETED"] },
  } satisfies Prisma.IndentWhereInput,

  /** Delivered trips where nobody has uploaded a usable POD yet. */
  tripsAwaitingPod: {
    status: "DELIVERED",
    pods: {
      none: {
        OR: [
          { status: { in: ["PENDING_VERIFICATION", "VERIFIED"] } },
          { status: "BAD_POD", resolutionStatus: { in: ["PENDING", "SLA_BREACHED"] } },
        ],
      },
    },
  } satisfies Prisma.TripWhereInput,

  /** POD received, client invoice fully paid and vendor balance settled — ready for closure. */
  indentsReadyToClose: {
    status: "POD_RECEIVED",
    trips: {
      some: {},
      every: {
        status: "CLOSED",
        invoiceLines: { some: { invoice: { status: "PAID" } } },
        OR: [
          { balancePaymentTask: { is: null } },
          { balancePaymentTask: { is: { status: "PROCESSED" } } },
        ],
      },
    },
  } satisfies Prisma.IndentWhereInput,

  onboarding: {
    status: { in: ["SUBMITTED", "PENDING"] },
    entityType: { not: "DRIVER" },
  } satisfies Prisma.OnboardingCaseWhereInput,

  openRequirements: { status: "OPEN" } satisfies Prisma.RequirementWhereInput,
};

export function indentActionWhere(scope: Prisma.IndentWhereInput = {}): Prisma.IndentWhereInput {
  return {
    ...scope,
    OR: [{ status: { in: INDENT_ACTION_STATUSES } }, workQueueWhere.indentsReadyToClose],
  };
}

/** Indents released to this vendor that are still open and not yet quoted by them. */
export function vendorOpenIndentWhere(vendorId: string): Prisma.IndentWhereInput {
  return {
    status: { in: ["RELEASED_TO_VENDORS", "QUOTING"] },
    vendorId: null,
    vendorReleases: { some: { vendorId } },
    quotes: { none: { vendorId } },
  };
}

/** Vendor trips that need the vendor to act (request advance, accept negotiation, upload/correct POD). */
export function vendorTripActionWhere(vendorId: string): Prisma.TripWhereInput {
  return {
    vendorId,
    OR: [
      {
        status: { in: ["PENDING", "DISPATCHED"] },
        advanceRequests: {
          none: { status: { notIn: ["REJECTED", "CANCELLED"] } },
        },
      },
      { advanceRequests: { some: { ...managedAdvanceSourceFilter(), status: "NEGOTIATED" } } },
      workQueueWhere.tripsAwaitingPod,
      {
        status: { notIn: ["CANCELLED"] },
        pods: { some: { status: "BAD_POD", resolutionStatus: { in: ["PENDING", "SLA_BREACHED"] } } },
      },
    ],
  };
}

export function clientOutstandingInvoiceWhere(clientId: string): Prisma.ClientInvoiceWhereInput {
  return { clientId, status: { in: ["SENT", "UNPAID", "PARTIALLY_PAID", "OVERDUE"] } };
}

export async function countWorkQueues() {
  const [
    financeAdvances,
    advanceApprovals,
    invoiceTasks,
    draftInvoices,
    balancePayments,
    vendorLedgerPending,
    clientPaymentsMissingProof,
    podVerification,
    openBadPods,
    podEscalations,
    placement,
    tripsAwaitingPod,
    indentsReadyToClose,
    onboarding,
    openRequirements,
  ] = await Promise.all([
    prisma.advanceRequest.count({ where: workQueueWhere.financeAdvances }),
    prisma.advanceRequest.count({ where: workQueueWhere.advanceApprovals }),
    prisma.invoiceTask.count({ where: workQueueWhere.invoiceTasks }),
    prisma.clientInvoice.count({ where: workQueueWhere.draftInvoices }),
    prisma.vendorBalancePaymentTask.count({ where: workQueueWhere.balancePayments }),
    prisma.vendorPayment.count({ where: workQueueWhere.vendorLedgerPending }),
    prisma.clientPayment.count({ where: workQueueWhere.clientPaymentsMissingProof }),
    prisma.indentPod.count({ where: workQueueWhere.podVerification }),
    prisma.indentPod.count({ where: workQueueWhere.openBadPods }),
    prisma.indentPod.count({ where: workQueueWhere.podEscalations }),
    prisma.indent.count({ where: workQueueWhere.placement }),
    prisma.trip.count({ where: workQueueWhere.tripsAwaitingPod }),
    prisma.indent.count({ where: workQueueWhere.indentsReadyToClose }),
    prisma.onboardingCase.count({ where: workQueueWhere.onboarding }),
    prisma.requirement.count({ where: workQueueWhere.openRequirements }),
  ]);

  return {
    financeAdvances,
    advanceApprovals,
    invoiceTasks,
    draftInvoices,
    balancePayments,
    vendorLedgerPending,
    clientPaymentsMissingProof,
    podVerification,
    openBadPods,
    podEscalations,
    placement,
    tripsAwaitingPod,
    indentsReadyToClose,
    onboarding,
    openRequirements,
    /** Everything the Vendor Payments nav item routes to (advance + balance queues + ledger). */
    vendorPayoutWork: financeAdvances + balancePayments + vendorLedgerPending,
    /** POD Queue page: pending verification + bad PODs awaiting correction. */
    podQueue: podVerification + openBadPods,
    /** Invoices page: invoices to create + drafts to finalize/send. */
    invoiceWork: invoiceTasks + draftInvoices,
  };
}

export async function countIndentActionQueue(scope: Prisma.IndentWhereInput = {}) {
  return prisma.indent.count({ where: indentActionWhere(scope) });
}

/** Vendor Payments hub: advance queue, balance queue, and manual ledger (same source as sidebar). */
export async function getVendorPaymentQueueCounts() {
  const { runAllSlaEscalations } = await import("./sla-escalation.service");
  await runAllSlaEscalations();
  const queues = await countWorkQueues();
  return {
    advances: queues.financeAdvances,
    balancePayments: queues.balancePayments,
    ledgerPending: queues.vendorLedgerPending,
    total: queues.vendorPayoutWork,
  };
}
