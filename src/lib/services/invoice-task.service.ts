import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { AUDIT_ACTIONS } from "../audit-actions";
import { INVOICE_SLA_MS } from "../constants";
import { computeTripCustomerRevenue } from "../finance-reconciliation";
const taskInclude = {
  trip: {
    select: {
      id: true,
      lrNumber: true,
      routeFrom: true,
      routeTo: true,
      status: true,
      clientRate: true,
      clientLoadingCharge: true,
      clientUnloadingCharge: true,
      podVerifiedAt: true,
      tripClosedAt: true,
    },
  },
  client: { select: { id: true, name: true } },
  indent: { select: { id: true, indentNumber: true } },
  invoice: { select: { id: true, invoiceNumber: true, status: true } },
};

function n(v: { toNumber(): number } | null | undefined) {
  return v ? v.toNumber() : 0;
}

function mapTask(
  row: Awaited<ReturnType<typeof prisma.invoiceTask.findFirst<{ include: typeof taskInclude }>>>
) {
  if (!row) return null;
  const now = Date.now();
  const deadlineMs = row.deadlineAt.getTime();
  const slaBreached = row.status === "SLA_BREACHED" || (row.status === "PENDING" && now > deadlineMs);

  return {
    id: row.id,
    tripId: row.tripId,
    indentId: row.indentId,
    clientId: row.clientId,
    status: row.status,
    podVerifiedAt: row.podVerifiedAt,
    deadlineAt: row.deadlineAt,
    slaBreachedAt: row.slaBreachedAt,
    escalatedAt: row.escalatedAt,
    invoiceId: row.invoiceId,
    slaBreached,
    slaRemainingMs: slaBreached ? 0 : Math.max(0, deadlineMs - now),
    trip: row.trip
      ? {
          id: row.trip.id,
          lrNumber: row.trip.lrNumber,
          route: `${row.trip.routeFrom} → ${row.trip.routeTo}`,
          routeFrom: row.trip.routeFrom,
          routeTo: row.trip.routeTo,
          status: row.trip.status,
          clientRate: n(row.trip.clientRate),
          clientLoadingCharge: n(row.trip.clientLoadingCharge),
          clientUnloadingCharge: n(row.trip.clientUnloadingCharge),
          billableTotal: computeTripCustomerRevenue({
            clientRate: n(row.trip.clientRate),
            clientLoadingCharge: n(row.trip.clientLoadingCharge),
            clientUnloadingCharge: n(row.trip.clientUnloadingCharge),
          }),
          podVerifiedAt: row.trip.podVerifiedAt,
          tripClosedAt: row.trip.tripClosedAt,
        }
      : null,
    client: row.client,
    indent: row.indent,
    invoice: row.invoice,
    createdAt: row.createdAt,
  };
}

/** Create or reactivate a finance invoice task when POD is verified. */
export async function createInvoiceTaskOnPodVerification(
  tripId: string,
  podVerifiedAt: Date,
  indentId?: string | null
) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: { id: true, clientId: true, indentId: true, lrNumber: true, indent: { select: { indentNumber: true } } },
  });
  if (!trip) return null;

  const deadlineAt = new Date(podVerifiedAt.getTime() + INVOICE_SLA_MS);
  const resolvedIndentId = indentId ?? trip.indentId;

  const existing = await prisma.invoiceTask.findUnique({ where: { tripId } });
  if (existing?.status === "COMPLETED") return mapTask(await prisma.invoiceTask.findFirst({ where: { id: existing.id }, include: taskInclude }));

  const task = existing
    ? await prisma.invoiceTask.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          podVerifiedAt,
          deadlineAt,
          slaBreachedAt: null,
          escalatedAt: null,
          indentId: resolvedIndentId,
        },
        include: taskInclude,
      })
    : await prisma.invoiceTask.create({
        data: {
          tripId,
          indentId: resolvedIndentId,
          clientId: trip.clientId,
          podVerifiedAt,
          deadlineAt,
          status: "PENDING",
        },
        include: taskInclude,
      });

  const { createImportantEvent } = await import("./important-event.service");
  await createImportantEvent({
    type: "INVOICE_PENDING",
    severity: "WARNING",
    title: `Invoice pending — ${trip.lrNumber}`,
    description: `POD verified. Invoice due within 24 hours.`,
    indentId: resolvedIndentId,
    relatedEntityId: task.id,
    dueAt: deadlineAt,
  });

  const { registerSlaTask } = await import("./sla.service");
  const { SLA_TYPES } = await import("../sla-types");
  await registerSlaTask({
    type: SLA_TYPES.INVOICE,
    entityId: task.id,
    startAt: podVerifiedAt,
    deadlineAt,
    tripId,
    indentId: resolvedIndentId,
  });

  const { notifyFinanceUsers } = await import("./sla-notify.service");
  await notifyFinanceUsers(
    `POD verified for trip ${trip.lrNumber}. Please create invoice within 24 hours.`,
    "INVOICE_TASK",
    task.id
  );

  return mapTask(task);
}

/** Mark invoice task complete when finance creates an invoice. */
export async function completeInvoiceTask(tripId: string, invoiceId: string) {
  const task = await prisma.invoiceTask.findUnique({ where: { tripId } });
  if (!task) return null;

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.invoiceTask.update({
      where: { id: task.id },
      data: { status: "COMPLETED", invoiceId },
      include: taskInclude,
    });

    await tx.importantEvent.updateMany({
      where: {
        type: { in: ["INVOICE_PENDING", "INVOICE_SLA_BREACHED"] },
        relatedEntityId: task.id,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      data: { status: "RESOLVED", resolvedAt: now },
    });

    const tripPods = await tx.indentPod.findMany({ where: { tripId }, select: { id: true } });
    if (tripPods.length) {
      await tx.importantEvent.updateMany({
        where: {
          type: "POD_VERIFIED",
          relatedEntityId: { in: tripPods.map((p) => p.id) },
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
        data: { status: "RESOLVED", resolvedAt: now },
      });
    }

    return row;
  });

  const { resolveSlaTask } = await import("./sla.service");
  const { SLA_TYPES } = await import("../sla-types");
  await resolveSlaTask(SLA_TYPES.INVOICE, task.id);

  return mapTask(updated);
}

/** Escalate invoice tasks not completed within 24 hours of POD verification. */
export async function escalateOverdueInvoiceTasks() {
  const now = new Date();
  const overdue = await prisma.invoiceTask.findMany({
    where: {
      status: "PENDING",
      deadlineAt: { lt: now },
      escalatedAt: null,
    },
    include: {
      trip: { select: { lrNumber: true } },
      client: { select: { name: true } },
      indent: { select: { indentNumber: true } },
    },
  });

  for (const task of overdue) {
    await prisma.invoiceTask.update({
      where: { id: task.id },
      data: { status: "SLA_BREACHED", slaBreachedAt: now, escalatedAt: now },
    });

    const { createImportantEvent } = await import("./important-event.service");
    await createImportantEvent({
      type: "INVOICE_SLA_BREACHED",
      severity: "CRITICAL",
      title: `Invoice SLA breached — ${task.trip.lrNumber}`,
      description: `Invoice not completed within 24 hours of POD verification for ${task.client.name}.`,
      indentId: task.indentId,
      relatedEntityId: task.id,
      dueAt: task.deadlineAt,
    });

    const { notifyAdminUsers } = await import("./sla-notify.service");
    await notifyAdminUsers(
      `Invoice SLA breached: trip ${task.trip.lrNumber} (${task.client.name}) requires admin attention.`,
      "INVOICE_TASK",
      task.id
    );

    const { markSlaTaskBreached } = await import("./sla.service");
    const { SLA_TYPES } = await import("../sla-types");
    await markSlaTaskBreached(SLA_TYPES.INVOICE, task.id, now);

    await logAudit({
      action: AUDIT_ACTIONS.INVOICE_SLA_BREACHED,
      entity: "InvoiceTask",
      entityId: task.id,
      tripId: task.tripId,
      meta: {
        lrNumber: task.trip.lrNumber,
        clientName: task.client.name,
        indentNumber: task.indent?.indentNumber,
      },
    });
  }

  return overdue.length;
}

/** List invoice tasks — POD verified, invoice not yet completed. */
export async function listInvoiceTasks(filters?: {
  status?: string;
  slaBreachedOnly?: boolean;
  limit?: number;
}) {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.INVOICE]);

  const statusFilter = filters?.slaBreachedOnly
    ? "SLA_BREACHED"
    : filters?.status ?? { in: ["PENDING", "SLA_BREACHED"] };

  const rows = await prisma.invoiceTask.findMany({
    where: {
      status: statusFilter,
      NOT: { invoice: { status: "DRAFT" } },
    },
    orderBy: [{ status: "desc" }, { deadlineAt: "asc" }],
    take: filters?.limit ?? 100,
    include: taskInclude,
  });

  return rows.map((r) => mapTask(r)!);
}

export async function countPendingInvoiceTasks() {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.INVOICE]);
  return prisma.invoiceTask.count({
    where: {
      status: { in: ["PENDING", "SLA_BREACHED"] },
      NOT: { invoice: { status: "DRAFT" } },
    },
  });
}

export async function countSlaBreachedInvoiceTasks() {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.INVOICE]);
  return prisma.invoiceTask.count({ where: { status: "SLA_BREACHED" } });
}

export async function getInvoiceTaskByTripId(tripId: string) {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.INVOICE]);
  const row = await prisma.invoiceTask.findUnique({ where: { tripId }, include: taskInclude });
  return mapTask(row);
}
