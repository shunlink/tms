import { prisma } from "../prisma";
import type { SessionUser } from "../auth";
import { ROLE_DEFAULT_TEAM, type TeamCode } from "../teams";
import { getGrantedPermissions, type PermissionKey } from "./permission.service";
import { EVENT_TARGET_TEAM } from "../team-event-routing";
import { ACTIVE_BALANCE_PAYMENT_STATUSES } from "../balance-payment-states";
import { managedAdvanceSourceFilter } from "../constants";
import { TRIP_ACTIVE_STATUSES } from "../dashboard-metrics";
import { countIndentActionQueue, countWorkQueues, workQueueWhere } from "./work-queues.service";
import type {
  AdminDashboardExtras,
  FinanceDashboardData,
  OperationsDashboardData,
  PendingTaskItem,
  SalesDashboardData,
} from "../team-dashboard-types";

const n = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

export async function resolveUserTeam(user: SessionUser) {
  if (!user.id) {
    return { teamCode: ROLE_DEFAULT_TEAM[user.role ?? "OPERATIONS"] ?? "OPERATIONS", teamId: null };
  }
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { teamId: true, team: { select: { code: true } }, role: true },
  });
  const teamCode =
    (row?.team?.code as TeamCode | undefined) ??
    ROLE_DEFAULT_TEAM[row?.role ?? user.role ?? "OPERATIONS"] ??
    "OPERATIONS";
  return { teamCode, teamId: row?.teamId ?? null };
}

export function isAdminTeam(teamCode: TeamCode, role?: string | null) {
  return teamCode === "ADMIN" || role === "SUPER_ADMIN" || role === "ADMIN";
}

function task(
  key: string,
  label: string,
  count: number,
  href: string,
  permission: PermissionKey,
  granted: Set<string>
): PendingTaskItem | null {
  if (!granted.has(permission) || count <= 0) return null;
  return { key, label, count, href };
}

function plural(count: number, singular: string, pluralForm?: string) {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
}

export async function getAdminDashboardExtras(user: SessionUser): Promise<AdminDashboardExtras> {
  const { runAllSlaEscalations } = await import("./sla-escalation.service");
  await runAllSlaEscalations();

  const granted = user.id ? await getGrantedPermissions(user.id) : new Set<string>();

  const { countSlaEscalations, listAdminEscalations, escalationHubHref } = await import(
    "./escalation.service"
  );

  const [
    queues,
    slaEscalationCounts,
    slaEscalationRows,
    advancePendingReview,
    teamActivityRaw,
    employeeActivityRaw,
  ] = await Promise.all([
    countWorkQueues(),
    countSlaEscalations(),
    listAdminEscalations(5),
    prisma.advanceRequest.count({ where: workQueueWhere.advanceApprovals }),
    prisma.auditLog.groupBy({
      by: ["teamCode"],
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, teamCode: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { teamCode: "desc" } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const {
    invoice: invoiceSlaBreached,
    advance: advanceSlaBreached,
    balance: balanceSlaBreached,
    pod: badPodEscalations,
    total: slaBreaches,
  } = slaEscalationCounts;

  const invoiceTasksPending = queues.invoiceWork;
  const teams = await prisma.team.findMany({ select: { code: true, name: true } });
  const teamNameByCode = new Map(teams.map((t) => [t.code, t.name]));

  const pendingTasks: PendingTaskItem[] = [];
  const add = (item: PendingTaskItem | null) => {
    if (item) pendingTasks.push(item);
  };

  add(
    task(
      "escalations",
      plural(slaBreaches, "SLA Escalation"),
      slaBreaches,
      escalationHubHref(slaEscalationCounts),
      "audit.view",
      granted
    )
  );
  add(task("pending-approvals", plural(advancePendingReview, "Pending Approval"), advancePendingReview, "/advance-payments", "advance.view", granted));
  add(task("pending-invoices", plural(invoiceTasksPending, "Invoice to Create or Send", "Invoices to Create or Send"), invoiceTasksPending, "/invoices", "invoice.view", granted));
  add(task("balance-escalations", plural(balanceSlaBreached, "Balance Payment Escalation"), balanceSlaBreached, "/balance-payments", "payment.view", granted));
  add(task("advance-escalations", plural(advanceSlaBreached, "Advance Escalation"), advanceSlaBreached, "/advance-payments", "advance.view", granted));
  add(task("bad-pod-escalations", plural(badPodEscalations, "Bad POD Escalation"), badPodEscalations, "/pods?view=bad", "pod.view", granted));

  return {
    pendingTasks,
    slaBreaches,
    escalations: slaBreaches,
    badPodEscalations,
    pendingInvoices: invoiceTasksPending,
    balancePaymentEscalations: balanceSlaBreached,
    advanceEscalations: advanceSlaBreached,
    teamActivity: teamActivityRaw.map((row) => ({
      teamCode: row.teamCode!,
      teamName: teamNameByCode.get(row.teamCode!) ?? row.teamCode!,
      count: row._count._all,
    })),
    employeeActivity: employeeActivityRaw.map((l) => ({
      id: l.id,
      actorName: l.actor?.name ?? l.userEmail,
      teamCode: l.teamCode,
      action: l.action,
      entity: l.entity,
      createdAt: l.createdAt,
    })),
    slaEscalations: slaEscalationRows,
  };
}

export async function getSalesDashboard(user: SessionUser): Promise<SalesDashboardData> {
  const { runAllSlaEscalations } = await import("./sla-escalation.service");
  await runAllSlaEscalations();

  const granted = user.id ? await getGrantedPermissions(user.id) : new Set<string>();
  const userId = user.id;
  const indentScope = userId ? { createdById: userId } : {};

  const [
    openRequirements,
    clientRaisedRequirements,
    indentsDraft,
    indentsActive,
    clientsActive,
    indentsNeedingAction,
    recentRequirements,
  ] = await Promise.all([
    prisma.requirement.count({ where: { status: "OPEN" } }),
    prisma.requirement.count({ where: { status: "OPEN", source: "PORTAL" } }),
    prisma.indent.count({ where: { ...indentScope, status: "DRAFT" } }),
    prisma.indent.count({
      where: {
        ...indentScope,
        status: { notIn: ["DRAFT", "COMPLETED", "CANCELLED"] },
      },
    }),
    prisma.client.count({ where: { isActive: true } }),
    countIndentActionQueue(indentScope),
    prisma.requirement.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { client: { select: { name: true } } },
    }),
  ]);

  const pendingTasks: PendingTaskItem[] = [];
  const add = (item: PendingTaskItem | null) => {
    if (item) pendingTasks.push(item);
  };
  add(task("client-requirements", plural(openRequirements, "Open Requirement"), openRequirements, "/requirements", "requirement.view", granted));
  if (clientRaisedRequirements > 0 && clientRaisedRequirements < openRequirements) {
    add(task("client-raised", plural(clientRaisedRequirements, "Client-Raised Requirement"), clientRaisedRequirements, "/requirements?source=PORTAL", "requirement.view", granted));
  }
  add(task("indents-action", plural(indentsNeedingAction, "Indent Requiring Action", "Indents Requiring Action"), indentsNeedingAction, "/indents", "indent.view", granted));
  add(task("draft-indents", plural(indentsDraft, "Draft Indent"), indentsDraft, "/indents?status=DRAFT", "indent.view", granted));

  return {
    team: "SALES",
    pendingTasks,
    metrics: [
      { key: "requirements", label: "Open Requirements", value: openRequirements, href: "/requirements" },
      { key: "client-raised", label: "Client-Raised", value: clientRaisedRequirements, href: "/requirements?source=PORTAL" },
      { key: "indents", label: "Active Indents", value: indentsActive, href: "/indents" },
      { key: "clients", label: "Active Clients", value: clientsActive, href: "/clients" },
    ],
    openRequirements,
    clientRaisedRequirements,
    indentsDraft,
    indentsActive,
    clientsActive,
    recentRequirements: recentRequirements.map((r) => ({
      id: r.id,
      reqNumber: r.reqNumber,
      client: r.client.name,
      route: `${r.routeFrom} → ${r.routeTo}`,
      status: r.status,
    })),
  };
}

export async function getOperationsDashboard(user: SessionUser): Promise<OperationsDashboardData> {
  const { runAllSlaEscalations } = await import("./sla-escalation.service");
  await runAllSlaEscalations();

  const granted = user.id ? await getGrantedPermissions(user.id) : new Set<string>();
  const userId = user.id;

  const indentIdsForUser = userId
    ? (
        await prisma.indent.findMany({
          where: { createdById: userId },
          select: { id: true },
        })
      ).map((i) => i.id)
    : [];

  const [activeTrips, myTrips, podsUploaded, queues, recentTrips] = await Promise.all([
    prisma.trip.count({ where: { status: { in: [...TRIP_ACTIVE_STATUSES] } } }),
    userId
      ? prisma.trip.count({
          where: {
            status: { in: [...TRIP_ACTIVE_STATUSES] },
            OR: [
              { indent: { createdById: userId } },
              ...(indentIdsForUser.length > 0 ? [{ indentId: { in: indentIdsForUser } }] : []),
            ],
          },
        })
      : 0,
    prisma.indentPod.count({ where: { indent: { status: { not: "CANCELLED" } } } }),
    countWorkQueues(),
    prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      where: userId
        ? {
            OR: [
              { indent: { createdById: userId } },
              ...(indentIdsForUser.length > 0 ? [{ indentId: { in: indentIdsForUser } }] : []),
            ],
          }
        : undefined,
      include: { client: { select: { name: true } } },
    }),
  ]);

  const opsEventTypes = Object.entries(EVENT_TARGET_TEAM)
    .filter(([, team]) => team === "OPERATIONS")
    .map(([type]) => type);

  const opsEvents = await prisma.importantEvent.findMany({
    where: {
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
      OR: [
        { targetTeamCode: "OPERATIONS" },
        { targetTeamCode: null, type: { in: opsEventTypes } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { indent: { select: { indentNumber: true } } },
  });

  const pendingTasks: PendingTaskItem[] = [];
  const add = (item: PendingTaskItem | null) => {
    if (item) pendingTasks.push(item);
  };
  const {
    podVerification: podsPendingVerification,
    openBadPods: badPods,
    podEscalations,
    placement: placementPending,
    tripsAwaitingPod,
    indentsReadyToClose,
  } = queues;

  add(task("pod-verifications", plural(podsPendingVerification, "POD Verification"), podsPendingVerification, "/pods?view=pending", "pod.view", granted));
  add(task("bad-pods", plural(badPods, "Bad POD Awaiting Correction", "Bad PODs Awaiting Correction"), badPods, "/pods?view=bad", "pod.view", granted));
  add(task("pod-escalations", plural(podEscalations, "POD Escalation"), podEscalations, "/pods?view=bad", "pod.view", granted));
  add(task("placement", plural(placementPending, "Placement Pending"), placementPending, "/placement", "placement.view", granted));
  add(task("trips-awaiting-pod", plural(tripsAwaitingPod, "Delivered Trip Awaiting POD", "Delivered Trips Awaiting POD"), tripsAwaitingPod, "/trips", "trip.view", granted));
  add(task("indents-ready-to-close", plural(indentsReadyToClose, "Indent Ready to Close", "Indents Ready to Close"), indentsReadyToClose, "/indents", "indent.edit", granted));

  return {
    team: "OPERATIONS",
    pendingTasks,
    metrics: [
      { key: "active-trips", label: "Active Trips", value: activeTrips, href: "/trips" },
      { key: "my-trips", label: "My Active Trips", value: myTrips, href: "/trips" },
      { key: "pod-pending", label: "POD Verification Pending", value: podsPendingVerification, href: "/pods?view=pending" },
      { key: "placement", label: "Placement Pending", value: placementPending, href: "/placement" },
    ],
    activeTrips,
    myTrips,
    podsUploaded,
    podsPendingVerification,
    badPods,
    podEscalations,
    placementPending,
    tripsAwaitingPod,
    indentsReadyToClose,
    importantEvents: opsEvents.map((e) => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      title: e.title,
      status: e.status,
      indentId: e.indentId,
      indentNumber: e.indent?.indentNumber ?? null,
      createdAt: e.createdAt,
    })),
    recentTrips: recentTrips.map((t) => ({
      id: t.id,
      lrNumber: t.lrNumber,
      route: `${t.routeFrom} → ${t.routeTo}`,
      client: t.client.name,
      status: t.status,
    })),
  };
}

import {
  getFinanceDashboardMetrics,
  type FinanceDashboardFilters,
} from "./finance-dashboard.service";

export async function getFinanceDashboard(
  user: SessionUser,
  filters: FinanceDashboardFilters = {}
): Promise<FinanceDashboardData> {
  const { runAllSlaEscalations } = await import("./sla-escalation.service");
  await runAllSlaEscalations();

  const granted = user.id ? await getGrantedPermissions(user.id) : new Set<string>();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    queues,
    advanceNegotiations,
    advanceVendorAccepted,
    advanceProcessing,
    advanceExternal,
    advanceSlaBreached,
    invoicePodVerified,
    invoiceDeadlineSoon,
    invoiceSlaBreached,
    recentInvoicesCount,
    balanceAwaitingApproval,
    balanceProcessed,
    balanceDeadlineSoon,
    balanceSlaBreached,
    clientAdvances,
    paymentsReceived,
    recentInvoices,
  ] = await Promise.all([
    countWorkQueues(),
    prisma.advanceRequest.count({ where: { ...managedAdvanceSourceFilter(), status: "NEGOTIATED" } }),
    prisma.advanceRequest.count({ where: { ...managedAdvanceSourceFilter(), status: "VENDOR_ACCEPTED" } }),
    prisma.advanceRequest.count({
      where: { ...managedAdvanceSourceFilter(), status: { in: ["APPROVED", "PROCESSING"] } },
    }),
    prisma.advanceRequest.count({ where: { source: "EXTERNAL", status: "EXTERNAL" } }),
    prisma.advanceRequest.count({ where: { ...managedAdvanceSourceFilter(), status: "SLA_BREACHED" } }),
    prisma.trip.count({
      where: {
        podVerifiedAt: { not: null },
        status: { not: "CANCELLED" },
        invoiceLines: { none: { invoice: { status: { not: "CANCELLED" } } } },
      },
    }),
    prisma.invoiceTask.count({
      where: { status: "PENDING", deadlineAt: { lte: in24h } },
    }),
    prisma.invoiceTask.count({ where: { status: "SLA_BREACHED" } }),
    prisma.clientInvoice.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.vendorBalancePaymentTask.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.vendorBalancePaymentTask.count({ where: { status: "PROCESSED" } }),
    prisma.vendorBalancePaymentTask.count({
      where: {
        status: { in: ACTIVE_BALANCE_PAYMENT_STATUSES },
        deadlineAt: { lte: in24h },
      },
    }),
    prisma.vendorBalancePaymentTask.count({ where: { status: "SLA_BREACHED" } }),
    prisma.clientPayment.count({ where: { paymentType: "ADVANCE" } }),
    prisma.clientPayment.count({ where: { paymentType: "PAYMENT" } }),
    prisma.clientInvoice.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { name: true } } },
    }),
  ]);

  const {
    financeAdvances,
    invoiceTasks: invoicePending,
    draftInvoices,
    balancePayments: balanceOutstanding,
    vendorLedgerPending,
    clientPaymentsMissingProof: missingProof,
  } = queues;
  const advancePending = queues.advanceApprovals;
  const balanceInProgress = balanceOutstanding - balanceAwaitingApproval - balanceSlaBreached;

  const pendingTasks: PendingTaskItem[] = [];
  const add = (item: PendingTaskItem | null) => {
    if (item) pendingTasks.push(item);
  };
  add(task("advance-requests", plural(financeAdvances, "Advance Request"), financeAdvances, "/advance-payments", "advance.view", granted));
  add(task("invoices", plural(invoicePending, "Create Client Invoice"), invoicePending, "/invoices", "invoice.view", granted));
  add(task("draft-invoices", plural(draftInvoices, "Draft Invoice to Finalize", "Draft Invoices to Finalize"), draftInvoices, "/invoices", "invoice.view", granted));
  add(task("balance-payments", plural(balanceOutstanding, "Balance Payment"), balanceOutstanding, "/balance-payments", "payment.view", granted));
  add(task("vendor-ledger", plural(vendorLedgerPending, "Vendor Payment Pending", "Vendor Payments Pending"), vendorLedgerPending, "/payments", "payment.view", granted));
  add(task("invoice-sla", plural(invoiceSlaBreached, "Invoice SLA Breach"), invoiceSlaBreached, "/invoices", "invoice.view", granted));
  add(task("advance-sla", plural(advanceSlaBreached, "Advance SLA Breach"), advanceSlaBreached, "/advance-payments", "advance.view", granted));
  add(task("balance-sla", plural(balanceSlaBreached, "Balance Payment SLA Breach"), balanceSlaBreached, "/balance-payments", "payment.view", granted));
  add(task("missing-proof", plural(missingProof, "Payment Missing Proof"), missingProof, "/client-payments", "client.payment.manage", granted));

  const metrics = await getFinanceDashboardMetrics(filters);

  return {
    team: "FINANCE",
    filters,
    metrics,
    pendingTasks,
    advance: {
      pendingRequests: advancePending,
      negotiations: advanceNegotiations,
      vendorAccepted: advanceVendorAccepted,
      processing: advanceProcessing,
      externalProvider: advanceExternal,
      slaBreached: advanceSlaBreached,
    },
    invoice: {
      podVerified: invoicePodVerified,
      invoicePending,
      draftInvoices,
      invoiceDeadlineSoon,
      slaBreached: invoiceSlaBreached,
      recentlyCreated: recentInvoicesCount,
    },
    balancePayment: {
      pending: balanceAwaitingApproval,
      processing: balanceInProgress,
      processed: balanceProcessed,
      deadlineSoon: balanceDeadlineSoon,
      slaBreached: balanceSlaBreached,
    },
    clientPayments: {
      advances: clientAdvances,
      paymentsReceived,
      missingProof,
    },
    recentInvoices: recentInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      client: inv.client.name,
      totalAmount: n(inv.totalAmount),
      status: inv.status,
      createdAt: inv.createdAt,
    })),
  };
}

export async function getTeamDashboard(user: SessionUser, teamCode: TeamCode) {
  switch (teamCode) {
    case "SALES":
      return getSalesDashboard(user);
    case "OPERATIONS":
      return getOperationsDashboard(user);
    case "FINANCE":
      return getFinanceDashboard(user);
    default:
      return null;
  }
}
