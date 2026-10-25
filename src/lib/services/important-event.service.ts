import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { AUDIT_ACTIONS } from "../audit-actions";
import { targetTeamForEventType } from "../team-event-routing";
import type { SessionUser } from "../auth";

type DbClient = Prisma.TransactionClient | typeof prisma;

const UNRESOLVED_EVENT_STATUSES = ["OPEN", "ACKNOWLEDGED"];

/**
 * Close open/acknowledged events once the underlying business action is done.
 * Every workflow completion point must call this so alerts never outlive their cause.
 */
export async function resolveImportantEvents(
  filter: {
    types: string[];
    indentId?: string | null;
    relatedEntityIds?: string[];
    excludeRelatedEntityIds?: string[];
  },
  options?: { actorId?: string | null; status?: "RESOLVED" | "DISMISSED"; db?: DbClient }
) {
  if (filter.types.length === 0) return 0;
  if (filter.relatedEntityIds && filter.relatedEntityIds.length === 0) return 0;
  const db = options?.db ?? prisma;
  const status = options?.status ?? "RESOLVED";
  const where: Prisma.ImportantEventWhereInput = {
    type: { in: filter.types },
    status: { in: UNRESOLVED_EVENT_STATUSES },
    ...(filter.indentId ? { indentId: filter.indentId } : {}),
    ...(filter.relatedEntityIds ? { relatedEntityId: { in: filter.relatedEntityIds } } : {}),
    ...(filter.excludeRelatedEntityIds?.length
      ? { NOT: { relatedEntityId: { in: filter.excludeRelatedEntityIds } } }
      : {}),
  };
  const result = await db.importantEvent.updateMany({
    where,
    data:
      status === "RESOLVED"
        ? { status, resolvedAt: new Date(), resolvedById: options?.actorId ?? null }
        : { status },
  });
  return result.count;
}

/** Dismiss every unresolved event for an indent (e.g. indent cancelled). */
export async function dismissIndentEvents(indentId: string, db: DbClient = prisma) {
  const result = await db.importantEvent.updateMany({
    where: { indentId, status: { in: UNRESOLVED_EVENT_STATUSES } },
    data: { status: "DISMISSED" },
  });
  return result.count;
}

export type ImportantEventInput = {
  type: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description?: string | null;
  indentId?: string | null;
  relatedEntityId?: string | null;
  dueAt?: Date | null;
  targetTeamCode?: string | null;
};

export async function createImportantEvent(input: ImportantEventInput) {
  return prisma.importantEvent.create({
    data: {
      type: input.type,
      severity: input.severity ?? "WARNING",
      title: input.title,
      description: input.description ?? null,
      indentId: input.indentId ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      dueAt: input.dueAt ?? null,
      targetTeamCode: input.targetTeamCode ?? targetTeamForEventType(input.type),
      status: "OPEN",
    },
  });
}

export async function listImportantEvents(filters?: {
  status?: string;
  severity?: string;
  indentId?: string;
  limit?: number;
}) {
  return prisma.importantEvent.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.severity ? { severity: filters.severity } : {}),
      ...(filters?.indentId ? { indentId: filters.indentId } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: filters?.limit ?? 100,
    include: {
      indent: { select: { indentNumber: true, status: true } },
      acknowledgedBy: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
  });
}

export async function actOnImportantEvent(
  id: string,
  action: "acknowledge" | "resolve" | "dismiss",
  actor?: SessionUser | null
) {
  const existing = await prisma.importantEvent.findUnique({ where: { id } });
  if (!existing) return null;

  const now = new Date();
  const patch =
    action === "acknowledge"
      ? { status: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedById: actor?.id ?? null }
      : action === "resolve"
        ? { status: "RESOLVED", resolvedAt: now, resolvedById: actor?.id ?? null }
        : { status: "DISMISSED" };

  const updated = await prisma.importantEvent.update({ where: { id }, data: patch });

  const auditAction =
    existing.type === "POD_REJECTED" && action === "resolve"
      ? AUDIT_ACTIONS.RESOLVED_BAD_POD
      : AUDIT_ACTIONS.ESCALATION_HANDLED;

  await logAudit({
    user: actor,
    action: auditAction,
    entity: "ImportantEvent",
    entityId: id,
    meta: { eventType: existing.type, escalationAction: action, title: existing.title },
    before: { status: existing.status },
    after: { status: updated.status },
  });

  return updated;
}

/** Count open important events (dashboard). */
export async function countOpenImportantEvents() {
  return prisma.importantEvent.count({ where: { status: "OPEN" } });
}

const ADVANCE_TERMINAL = new Set(["PROCESSED", "REJECTED", "CANCELLED", "EXTERNAL"]);
const INDENT_TERMINAL = new Set(["CANCELLED", "COMPLETED"]);
const INDENT_PAST_DRIVER_ASSIGNMENT = new Set([
  "IN_TRANSIT",
  "DELIVERED",
  "POD_PENDING",
  "POD_RECEIVED",
  "COMPLETED",
]);

/**
 * Close events whose underlying business state no longer needs action.
 * Derives event status from the domain records (the source of truth), so alerts
 * stay correct even for paths that pre-date explicit resolution calls.
 */
export async function reconcileImportantEvents() {
  const open = await prisma.importantEvent.findMany({
    where: { status: { in: UNRESOLVED_EVENT_STATUSES } },
    select: { id: true, type: true, indentId: true, relatedEntityId: true, createdAt: true },
  });
  if (open.length === 0) return 0;

  const idsOf = (types: string[]) =>
    Array.from(
      new Set(
        open
          .filter((e) => types.includes(e.type) && e.relatedEntityId)
          .map((e) => e.relatedEntityId as string)
      )
    );
  const indentIds = Array.from(new Set(open.map((e) => e.indentId).filter(Boolean) as string[]));

  const podTypes = [
    "POD_PENDING",
    "POD_REJECTED",
    "POD_SLA_BREACHED",
    "POD_VERIFIED",
    "POD_VENDOR_DEBIT_NOTE_REQUIRED",
  ];
  const [indents, quotes, advances, pods, invoiceTasks, balanceTasks, tripsWithIndent] =
    await Promise.all([
      indentIds.length
        ? prisma.indent.findMany({
            where: { id: { in: indentIds } },
            select: {
              id: true,
              status: true,
              vendorId: true,
              driverId: true,
              placementStatus: true,
              vendorAllocatedAt: true,
              advanceStatus: true,
            },
          })
        : [],
      prisma.vendorQuote.findMany({
        where: { id: { in: idsOf(["VENDOR_QUOTE_RECEIVED"]) } },
        select: { id: true, status: true },
      }),
      prisma.advanceRequest.findMany({
        where: {
          id: { in: idsOf(["ADVANCE_PENDING", "ADVANCE_SLA_BREACHED", "EXTERNAL_ADVANCE_SELECTED"]) },
        },
        select: { id: true, status: true, externalReference: true, approvedAmount: true },
      }),
      prisma.indentPod.findMany({
        where: { id: { in: idsOf(podTypes) } },
        select: { id: true, status: true, resolutionStatus: true, tripId: true, indentId: true },
      }),
      prisma.invoiceTask.findMany({
        where: { id: { in: idsOf(["INVOICE_PENDING", "INVOICE_SLA_BREACHED"]) } },
        select: { id: true, status: true },
      }),
      prisma.vendorBalancePaymentTask.findMany({
        where: { id: { in: idsOf(["BALANCE_PAYMENT_PENDING", "BALANCE_PAYMENT_SLA_BREACHED"]) } },
        select: { id: true, status: true },
      }),
      indentIds.length
        ? prisma.trip.findMany({
            where: { indentId: { in: indentIds } },
            select: { id: true, indentId: true },
          })
        : [],
    ]);

  const podTripIds = Array.from(new Set(pods.map((p) => p.tripId).filter(Boolean) as string[]));
  const podIndentIds = Array.from(new Set(pods.map((p) => p.indentId)));
  const [verifiedPods, invoicedTrips] = await Promise.all([
    prisma.indentPod.findMany({
      where: {
        status: "VERIFIED",
        OR: [{ tripId: { in: podTripIds } }, { indentId: { in: podIndentIds } }],
      },
      select: { tripId: true, indentId: true },
    }),
    prisma.invoiceTask.findMany({
      where: { tripId: { in: podTripIds }, status: "COMPLETED" },
      select: { tripId: true },
    }),
  ]);

  const indentById = new Map(indents.map((i) => [i.id, i]));
  const quoteById = new Map(quotes.map((q) => [q.id, q]));
  const advanceById = new Map(advances.map((a) => [a.id, a]));
  const podById = new Map(pods.map((p) => [p.id, p]));
  const invoiceTaskById = new Map(invoiceTasks.map((t) => [t.id, t]));
  const balanceTaskById = new Map(balanceTasks.map((t) => [t.id, t]));
  const indentsWithTrip = new Set(tripsWithIndent.map((t) => t.indentId));
  const verifiedTripIds = new Set(verifiedPods.map((p) => p.tripId).filter(Boolean));
  const verifiedIndentIds = new Set(verifiedPods.map((p) => p.indentId));
  const invoicedTripIds = new Set(invoicedTrips.map((t) => t.tripId));

  const latestDriverOtpEvent = new Map<string, Date>();
  for (const e of open) {
    if (e.type !== "DRIVER_OTP_PENDING" || !e.indentId) continue;
    const prev = latestDriverOtpEvent.get(e.indentId);
    if (!prev || e.createdAt > prev) latestDriverOtpEvent.set(e.indentId, e.createdAt);
  }

  const toResolve: string[] = [];
  const toDismiss: string[] = [];

  for (const e of open) {
    const indent = e.indentId ? indentById.get(e.indentId) : undefined;
    if (indent?.status === "CANCELLED") {
      toDismiss.push(e.id);
      continue;
    }
    const rel = e.relatedEntityId;
    let done = false;

    switch (e.type) {
      case "VENDOR_QUOTE_RECEIVED": {
        const quote = rel ? quoteById.get(rel) : undefined;
        done =
          Boolean(indent?.vendorId) ||
          (indent ? INDENT_TERMINAL.has(indent.status) : false) ||
          (quote ? quote.status !== "ACTIVE" : Boolean(rel));
        break;
      }
      case "DRIVER_OTP_PENDING": {
        if (!indent) break;
        const latest = latestDriverOtpEvent.get(indent.id);
        done =
          (rel != null && indent.driverId === rel) ||
          (latest != null && e.createdAt < latest) ||
          indentsWithTrip.has(indent.id) ||
          INDENT_PAST_DRIVER_ASSIGNMENT.has(indent.status) ||
          INDENT_TERMINAL.has(indent.status);
        break;
      }
      case "ADVANCE_PENDING":
      case "ADVANCE_SLA_BREACHED": {
        const adv = rel ? advanceById.get(rel) : undefined;
        if (adv) {
          done = ADVANCE_TERMINAL.has(adv.status);
        } else if (!rel && indent) {
          done =
            indent.advanceStatus === "PAID" ||
            !["DRAFT", "WAITING_FOR_ADVANCE", "ADVANCE_PENDING"].includes(indent.status);
        }
        break;
      }
      case "EXTERNAL_ADVANCE_SELECTED": {
        const adv = rel ? advanceById.get(rel) : undefined;
        done = Boolean(adv && (adv.externalReference || adv.approvedAmount != null || adv.status === "CANCELLED"));
        break;
      }
      case "POD_PENDING":
      case "POD_UPLOADED": {
        const pod = rel ? podById.get(rel) : undefined;
        done = pod ? pod.status !== "PENDING_VERIFICATION" : false;
        break;
      }
      case "POD_REJECTED":
      case "POD_SLA_BREACHED":
      case "POD_VENDOR_DEBIT_NOTE_REQUIRED": {
        const pod = rel ? podById.get(rel) : undefined;
        if (pod) {
          done =
            pod.status !== "BAD_POD" ||
            pod.resolutionStatus === "CORRECTED" ||
            (pod.tripId ? verifiedTripIds.has(pod.tripId) : verifiedIndentIds.has(pod.indentId));
        }
        break;
      }
      case "POD_VERIFIED": {
        const pod = rel ? podById.get(rel) : undefined;
        done = Boolean(pod?.tripId && invoicedTripIds.has(pod.tripId));
        break;
      }
      case "INVOICE_PENDING":
      case "INVOICE_SLA_BREACHED": {
        const task = rel ? invoiceTaskById.get(rel) : undefined;
        done = task?.status === "COMPLETED";
        break;
      }
      case "BALANCE_PAYMENT_PENDING":
      case "BALANCE_PAYMENT_SLA_BREACHED": {
        const task = rel ? balanceTaskById.get(rel) : undefined;
        done = task?.status === "PROCESSED";
        break;
      }
      case "ALLOCATION_PLACEMENT_DEADLINE":
      case "PLACEMENT_DEADLINE_EXCEEDED": {
        if (!indent) break;
        done =
          indent.placementStatus === "VEHICLE_REACHED" ||
          INDENT_TERMINAL.has(indent.status) ||
          (indent.vendorAllocatedAt != null && e.createdAt < indent.vendorAllocatedAt);
        break;
      }
      default:
        if (indent?.status === "COMPLETED") done = true;
    }

    if (done) toResolve.push(e.id);
  }

  const now = new Date();
  if (toResolve.length) {
    await prisma.importantEvent.updateMany({
      where: { id: { in: toResolve }, status: { in: UNRESOLVED_EVENT_STATUSES } },
      data: { status: "RESOLVED", resolvedAt: now },
    });
  }
  if (toDismiss.length) {
    await prisma.importantEvent.updateMany({
      where: { id: { in: toDismiss }, status: { in: UNRESOLVED_EVENT_STATUSES } },
      data: { status: "DISMISSED" },
    });
  }
  return toResolve.length + toDismiss.length;
}
