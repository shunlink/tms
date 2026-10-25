import { prisma } from "../prisma";
import { cached } from "../cache";
import { dataVersion } from "../data-version";
import type { SidebarPendingCountKey, SidebarPendingCounts } from "../sidebar-pending-keys";
import { PENDING_COUNT_PERMISSIONS } from "../sidebar-pending-keys";
import type { TeamCode } from "../teams";
import { countSlaEscalations } from "./escalation.service";
import { countUnreadNotifications } from "./notification-read.service";
import { isOnboardingRequestsSuperAdmin } from "../onboarding-request-access";
import {
  clientOutstandingInvoiceWhere,
  countIndentActionQueue,
  countWorkQueues,
  vendorOpenIndentWhere,
  vendorTripActionWhere,
} from "./work-queues.service";
import { countOnboardingRequestsForUser } from "./onboarding.service";

export type PendingCountsContext = {
  userId: string;
  role: string;
  teamCode: TeamCode;
  clientId?: string | null;
  vendorId?: string | null;
  granted: Set<string>;
};

export type SidebarCountsResponse = {
  /** Unread in-app notifications for the current user. */
  notificationUnreadCount?: number;
} & SidebarPendingCounts;

function actionCacheKey(ctx: PendingCountsContext) {
  return `sidebar:actions:${ctx.userId}:${ctx.role}:${ctx.teamCode}:v${dataVersion()}`;
}

function notifyCacheKey(userId: string) {
  return `sidebar:notify:${userId}:v${dataVersion()}`;
}

function canSeeKey(ctx: PendingCountsContext, key: SidebarPendingCountKey): boolean {
  if (ctx.role === "SUPER_ADMIN") return true;
  const perm = PENDING_COUNT_PERMISSIONS[key];
  if (perm === null) {
    if (key.startsWith("vendor") && ctx.role === "VENDOR" && ctx.vendorId) return true;
    if (key.startsWith("client") && ctx.role === "CLIENT" && ctx.clientId) return true;
    return false;
  }
  return ctx.granted.has(perm);
}

function salesIndentScope(ctx: PendingCountsContext) {
  return ctx.teamCode === "SALES" && ctx.role !== "ADMIN" && ctx.role !== "SUPER_ADMIN"
    ? { createdById: ctx.userId }
    : {};
}

/** Actionable work queues — viewing a page does not change these counts. */
async function computePendingActionCounts(ctx: PendingCountsContext): Promise<SidebarPendingCounts> {
  const { runAllSlaEscalations } = await import("./sla-escalation.service");
  await runAllSlaEscalations();

  const isPortalUser = ctx.role === "VENDOR" || ctx.role === "CLIENT" || ctx.role === "DRIVER";

  const [queues, indents, audit, vendorOpenIndents, vendorTrips, vendorPaymentsPortal, clientInvoices, onboardingRequests] =
    await Promise.all([
      isPortalUser ? null : countWorkQueues(),
      isPortalUser ? 0 : countIndentActionQueue(salesIndentScope(ctx)),
      isPortalUser ? 0 : countSlaEscalations().then((r) => r.total),
      ctx.vendorId ? prisma.indent.count({ where: vendorOpenIndentWhere(ctx.vendorId) }) : 0,
      ctx.vendorId ? prisma.trip.count({ where: vendorTripActionWhere(ctx.vendorId) }) : 0,
      ctx.vendorId
        ? prisma.vendorPayment.count({ where: { vendorId: ctx.vendorId, status: { not: "PAID" } } })
        : 0,
      ctx.clientId ? prisma.clientInvoice.count({ where: clientOutstandingInvoiceWhere(ctx.clientId) }) : 0,
      isPortalUser
        ? 0
        : countOnboardingRequestsForUser(ctx.userId, isOnboardingRequestsSuperAdmin(ctx.role)),
    ]);

  const raw: SidebarPendingCounts = {
    ...(queues
      ? {
          invoices: queues.invoiceWork,
          clientPayments: queues.clientPaymentsMissingProof,
          vendorPayments: queues.vendorPayoutWork,
          balancePayments: queues.balancePayments,
          advancePayments: queues.financeAdvances,
          placement: queues.placement,
          onboarding: queues.onboarding,
          onboardingRequests,
          requirements: queues.openRequirements,
          trips: queues.tripsAwaitingPod,
          pods: queues.podQueue,
        }
      : {}),
    indents,
    audit,
    vendorOpenIndents,
    vendorTrips,
    vendorPaymentsPortal,
    clientInvoices,
  };

  const filtered: SidebarPendingCounts = {};
  for (const [key, value] of Object.entries(raw) as [SidebarPendingCountKey, number][]) {
    if (key === "notifications") continue;
    if (!canSeeKey(ctx, key)) continue;
    filtered[key] = value;
  }

  return filtered;
}

export async function getSidebarPendingCounts(ctx: PendingCountsContext): Promise<SidebarCountsResponse> {
  const actionCounts = await cached(actionCacheKey(ctx), 15, () => computePendingActionCounts(ctx));

  let notificationUnreadCount: number | undefined;
  if (canSeeKey(ctx, "notifications")) {
    notificationUnreadCount = await cached(notifyCacheKey(ctx.userId), 5, () =>
      countUnreadNotifications(ctx.userId)
    );
  }

  const result: SidebarCountsResponse = { ...actionCounts };
  if (notificationUnreadCount !== undefined && notificationUnreadCount > 0) {
    result.notificationUnreadCount = notificationUnreadCount;
    result.notifications = notificationUnreadCount;
  }

  return result;
}
