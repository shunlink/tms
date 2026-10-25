import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { AUDIT_ACTIONS } from "../audit-actions";
import { POD_SLA_MS } from "../constants";
import { assertPodTransition } from "../pod-states";
import type { SessionUser } from "../auth";
import type { PodSource } from "../constants";

const POD_INCLUDE = {
  file: true,
  backFile: true,
  uploadedBy: { select: { id: true, name: true, email: true } },
  verifiedBy: { select: { id: true, name: true } },
  rejectedBy: { select: { id: true, name: true } },
  previousPod: {
    include: {
      file: true,
      backFile: true,
      rejectedBy: { select: { id: true, name: true } },
    },
  },
  indent: { select: { id: true, indentNumber: true, status: true } },
  trip: { select: { id: true, lrNumber: true, status: true } },
};

export type PodUploadInput = {
  frontFileId: string;
  backFileId: string;
  source: PodSource;
  remarks?: string | null;
  tripId?: string | null;
  previousPodId?: string | null;
};

export type PodVerificationCharges = {
  loadingCharge?: number;
  unloadingCharge?: number;
};

function chargeAmount(v: number | undefined) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error("Charges must be zero or a positive amount");
  return Math.round(n * 100) / 100;
}

/** Issued vendor debit note required before marking a bad POD as good. */
export async function findIssuedVendorReductionNoteForPod(
  tripId: string,
  indentPodId?: string | null
) {
  return prisma.financialNote.findFirst({
    where: {
      status: "ISSUED",
      counterpartyType: "VENDOR",
      businessPurpose: "VENDOR_FREIGHT_REDUCTION",
      tripId,
      ...(indentPodId ? { indentPodId } : {}),
    },
    orderBy: { issuedAt: "desc" },
    select: { id: true, noteNumber: true, status: true, issuedAt: true },
  });
}

export async function assertVendorDebitNoteGateForPod(tripId: string, indentPodId: string) {
  const note = await findIssuedVendorReductionNoteForPod(tripId, indentPodId);
  if (!note) {
    throw new Error(
      "An issued vendor debit note (freight reduction) linked to this bad POD is required before marking as good"
    );
  }
  return note;
}

export async function getVendorDebitNoteGateStatus(tripId: string | null | undefined, indentPodId: string) {
  if (!tripId) {
    return { satisfied: false as const, note: null };
  }
  const note = await findIssuedVendorReductionNoteForPod(tripId, indentPodId);
  return { satisfied: Boolean(note), note };
}

async function hasUnresolvedBadPodOnTrip(tripId: string, excludePodId?: string) {
  const row = await prisma.indentPod.findFirst({
    where: {
      tripId,
      status: "BAD_POD",
      resolutionStatus: { in: ["PENDING", "SLA_BREACHED"] },
      ...(excludePodId ? { id: { not: excludePodId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(row);
}

function buildDebitNoteDraftPath(opts: {
  tripId: string;
  indentPodId: string;
  vendorId: string;
  indentId: string;
}) {
  const q = new URLSearchParams({
    tripId: opts.tripId,
    indentPodId: opts.indentPodId,
    indentId: opts.indentId,
    vendorId: opts.vendorId,
    purpose: "VENDOR_FREIGHT_REDUCTION",
    noteType: "DEBIT_NOTE",
  });
  return `/financial-notes/new?${q.toString()}`;
}

function mapPodSourceFromRole(role?: string | null): PodSource {
  if (role === "DRIVER") return "DRIVER";
  if (role === "VENDOR") return "VENDOR";
  return "EMPLOYEE";
}

function isPodComplete(fileId: string | null | undefined, backFileId: string | null | undefined) {
  return Boolean(fileId && backFileId);
}

function resolvePodStatus(fileId: string | null | undefined, backFileId: string | null | undefined) {
  return isPodComplete(fileId, backFileId) ? "PENDING_VERIFICATION" : "INCOMPLETE";
}

async function markIndentPodPending(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], indentId: string) {
  const indent = await tx.indent.findFirst({ where: { id: indentId }, select: { status: true } });
  if (!indent) return;
  if (indent.status === "DELIVERED") {
    await tx.indent.update({ where: { id: indentId }, data: { status: "POD_PENDING" } });
  }
}

/** Trip statuses where a vendor/driver POD upload should enter the verification queue. */
const POD_UPLOAD_ELIGIBLE_TRIP_STATUSES = new Set([
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "POD_RECEIVED",
]);

async function notifyPodPending(indentId: string, indentNumber: string, podId: string) {
  const { createImportantEvent } = await import("./important-event.service");
  await createImportantEvent({
    type: "POD_PENDING",
    severity: "INFO",
    title: `POD pending verification — ${indentNumber}`,
    indentId,
    relatedEntityId: podId,
    targetTeamCode: "FINANCE",
  });
}

async function createPodRecord(
  indentId: string,
  data: PodUploadInput,
  actor?: SessionUser | null
) {
  const status = resolvePodStatus(data.frontFileId, data.backFileId);
  if (status !== "PENDING_VERIFICATION") {
    throw new Error("Both front and back POD images are required");
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.indentPod.create({
      data: {
        indentId,
        fileId: data.frontFileId,
        backFileId: data.backFileId,
        source: data.source,
        remarks: data.remarks ?? null,
        uploadedById: actor?.id ?? null,
        tripId: data.tripId ?? null,
        previousPodId: data.previousPodId ?? null,
        status,
      },
    });

    if (data.previousPodId) {
      await tx.indentPod.update({
        where: { id: data.previousPodId },
        data: { resolutionStatus: "CORRECTED" },
      });
    }

    await markIndentPodPending(tx, indentId);
    return created;
  });
}

/** Upload POD for an indent (driver, vendor via indent API, or operations/admin). */
export async function uploadPod(
  indentId: string,
  data: PodUploadInput,
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;

  const pod = await createPodRecord(indentId, data, actor);
  await notifyPodPending(indentId, indent.indentNumber, pod.id);

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.POD_UPLOADED,
    entity: "IndentPod",
    entityId: pod.id,
    meta: { indentId, source: data.source, tripId: data.tripId },
  });

  return getPodById(pod.id);
}

/** Bridge trip document upload into the indent POD verification workflow. */
export async function uploadPodFromTrip(
  tripId: string,
  frontFileId: string,
  backFileId: string,
  actor?: SessionUser | null,
  remarks?: string | null
) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: { id: true, indentId: true, status: true },
  });
  if (!trip?.indentId) return null;
  const indentId = trip.indentId;
  if (!POD_UPLOAD_ELIGIBLE_TRIP_STATUSES.has(trip.status)) return null;

  if (await hasUnresolvedBadPodOnTrip(tripId)) {
    throw new Error(
      "This trip has a bad POD awaiting vendor debit note resolution; uploads cannot replace verification"
    );
  }

  const alreadySubmitted = await prisma.indentPod.findFirst({
    where: {
      tripId,
      status: { in: ["PENDING_VERIFICATION", "VERIFIED", "BAD_POD"] },
    },
    select: { id: true },
  });
  if (alreadySubmitted) {
    throw new Error(
      "A POD has already been submitted for this trip. Only operations can replace it from the indent POD verification panel."
    );
  }

  const existingOpen = await prisma.indentPod.findFirst({
    where: { tripId, status: "INCOMPLETE" },
    orderBy: { uploadedAt: "desc" },
  });

  if (existingOpen) {
    const nextFront = frontFileId || existingOpen.fileId;
    const nextBack = backFileId || existingOpen.backFileId;
    const nextStatus = resolvePodStatus(nextFront, nextBack);
    const wasComplete = existingOpen.status === "PENDING_VERIFICATION";

    await prisma.indentPod.update({
      where: { id: existingOpen.id },
      data: {
        fileId: nextFront,
        backFileId: nextBack,
        status: nextStatus,
        uploadedAt: new Date(),
        uploadedById: actor?.id ?? existingOpen.uploadedById,
        remarks: remarks ?? existingOpen.remarks,
      },
    });

    if (nextStatus === "PENDING_VERIFICATION" && !wasComplete) {
      const indent = await prisma.indent.findFirst({
        where: { id: trip.indentId },
        select: { indentNumber: true },
      });
      if (indent) await notifyPodPending(trip.indentId, indent.indentNumber, existingOpen.id);
    }

    return getPodById(existingOpen.id);
  }

  const source = actor ? mapPodSourceFromRole(actor.role) : "VENDOR";
  const status = resolvePodStatus(frontFileId, backFileId);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.indentPod.create({
      data: {
        indentId,
        fileId: frontFileId,
        backFileId,
        source,
        remarks: remarks ?? null,
        uploadedById: actor?.id ?? null,
        tripId,
        status,
      },
    });
    if (status === "PENDING_VERIFICATION") {
      await markIndentPodPending(tx, indentId);
    }
    return row;
  });

  if (status === "PENDING_VERIFICATION") {
    const indent = await prisma.indent.findFirst({
      where: { id: indentId },
      select: { indentNumber: true },
    });
    if (indent) await notifyPodPending(indentId, indent.indentNumber, created.id);
  }

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.POD_UPLOADED,
    entity: "IndentPod",
    entityId: created.id,
    meta: { indentId, source, tripId, complete: status === "PENDING_VERIFICATION" },
  });

  return getPodById(created.id);
}

/** Backfill POD verification records for trip document uploads that never entered the queue. */
export async function syncOrphanTripPodUploads(tripId?: string) {
  const podDocs = await prisma.documentAttachment.findMany({
    where: {
      entityType: "TRIP",
      documentType: "POD",
      ...(tripId ? { entityId: tripId } : {}),
    },
    include: { file: true },
    orderBy: { createdAt: "desc" },
  });

  const seenTrips = new Set<string>();
  for (const doc of podDocs) {
    if (seenTrips.has(doc.entityId)) continue;
    seenTrips.add(doc.entityId);

    const trip = await prisma.trip.findFirst({
      where: { id: doc.entityId },
      select: { id: true, indentId: true, status: true },
    });
    if (!trip?.indentId || !POD_UPLOAD_ELIGIBLE_TRIP_STATUSES.has(trip.status)) continue;

    const linked = await prisma.indentPod.findFirst({
      where: { tripId: trip.id, fileId: doc.fileId },
    });
    if (linked) continue;

    const hasQueueEntry = await prisma.indentPod.findFirst({
      where: {
        tripId: trip.id,
        status: { in: ["PENDING_VERIFICATION", "VERIFIED"] },
      },
    });
    if (hasQueueEntry) continue;

    // Legacy single-file orphan — cannot auto-complete without back image
  }
}

/** Replace front/back images on a pending POD (finance review only — does not resolve bad POD). */
export async function replacePodImages(
  podId: string,
  data: { frontFileId: string; backFileId: string; remarks?: string | null },
  actor?: SessionUser | null
) {
  const pod = await prisma.indentPod.findFirst({ where: { id: podId } });
  if (!pod || pod.status !== "PENDING_VERIFICATION") return null;
  if (!isPodComplete(data.frontFileId, data.backFileId)) {
    throw new Error("Both front and back POD images are required");
  }

  await prisma.indentPod.update({
    where: { id: podId },
    data: {
      fileId: data.frontFileId,
      backFileId: data.backFileId,
      remarks: data.remarks ?? pod.remarks,
      uploadedAt: new Date(),
      uploadedById: actor?.id ?? pod.uploadedById,
    },
  });

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.POD_UPLOADED,
    entity: "IndentPod",
    entityId: podId,
    meta: { replacedImages: true, indentId: pod.indentId },
  });

  return getPodById(podId);
}

/** @deprecated Bad POD is resolved via debit note + markBadPodAsGood — use replacePodImages on pending PODs. */
export async function correctBadPod(
  badPodId: string,
  data: { frontFileId: string; backFileId: string; remarks?: string | null },
  _actor?: SessionUser | null
) {
  throw new Error(
    "Corrected POD upload is not supported for bad POD; issue a vendor debit note and mark as good, or re-upload on pending verification only"
  );
}

async function completePodVerification(
  pod: {
    id: string;
    indentId: string;
    tripId: string | null;
    status: string;
    indent: { indentNumber: string };
  },
  charges: PodVerificationCharges,
  actor?: SessionUser | null,
  opts?: { markBadPodResolved?: boolean }
) {
  const now = new Date();
  const loading = chargeAmount(charges.loadingCharge);
  const unloading = chargeAmount(charges.unloadingCharge);

  await prisma.$transaction(async (tx) => {
    await tx.indentPod.update({
      where: { id: pod.id },
      data: {
        status: "VERIFIED",
        verifiedAt: now,
        verifiedById: actor?.id ?? null,
        ...(opts?.markBadPodResolved
          ? { resolutionStatus: "CORRECTED" }
          : {}),
      },
    });

    await tx.indent.update({
      where: { id: pod.indentId },
      data: { status: "POD_RECEIVED", podReceivedAt: now },
    });

    const resolvedTripId =
      pod.tripId ??
      (
        await tx.trip.findFirst({
          where: { indentId: pod.indentId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      )?.id ??
      null;

    if (resolvedTripId) {
      if (!pod.tripId) {
        await tx.indentPod.update({
          where: { id: pod.id },
          data: { tripId: resolvedTripId },
        });
      }
      await tx.trip.update({
        where: { id: resolvedTripId },
        data: {
          status: "CLOSED",
          podReceivedAt: now,
          podVerifiedAt: now,
          podVerifiedById: actor?.id ?? null,
          tripClosedAt: now,
          clientLoadingCharge: loading,
          clientUnloadingCharge: unloading,
        },
      });
    }

    const { resolveImportantEvents } = await import("./important-event.service");
    await resolveImportantEvents(
      {
        types: [
          "POD_PENDING",
          "POD_REJECTED",
          "POD_SLA_BREACHED",
          "POD_VENDOR_DEBIT_NOTE_REQUIRED",
        ],
        relatedEntityIds: [pod.id],
      },
      { actorId: actor?.id, db: tx }
    );
  });

  const tripId =
    pod.tripId ??
    (
      await prisma.trip.findFirst({
        where: { indentId: pod.indentId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    )?.id ??
    null;

  if (tripId) {
    const { notifyClientOfTripStatus } = await import("../notifications");
    await notifyClientOfTripStatus(tripId, "POD_RECEIVED");

    const { createImportantEvent } = await import("./important-event.service");
    await createImportantEvent({
      type: "POD_VERIFIED",
      severity: "INFO",
      title: `POD verified — ${pod.indent.indentNumber}`,
      indentId: pod.indentId,
      relatedEntityId: pod.id,
      targetTeamCode: "FINANCE",
    });

    const { createInvoiceTaskOnPodVerification } = await import("./invoice-task.service");
    await createInvoiceTaskOnPodVerification(tripId, now, pod.indentId);

    const { createBalancePaymentTaskOnPodVerification } = await import("./vendor-balance-payment.service");
    await createBalancePaymentTaskOnPodVerification(tripId, now, pod.indentId);
  }

  if (opts?.markBadPodResolved) {
    const { resolveSlaTask } = await import("./sla.service");
    const { SLA_TYPES } = await import("../sla-types");
    await resolveSlaTask(SLA_TYPES.BAD_POD, pod.id);
  }

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.POD_VERIFIED,
    entity: "IndentPod",
    entityId: pod.id,
    before: { status: pod.status },
    after: { status: "VERIFIED", loading, unloading },
  });

  return getPodById(pod.id);
}

/** Verify a pending POD — does NOT auto-verify on upload. */
export async function verifyPod(
  podId: string,
  actor?: SessionUser | null,
  charges: PodVerificationCharges = {}
) {
  const pod = await prisma.indentPod.findFirst({
    where: { id: podId },
    include: { indent: true, trip: true },
  });
  if (!pod) return null;
  if (!isPodComplete(pod.fileId, pod.backFileId)) {
    throw new Error("Both front and back POD images are required before verification");
  }

  assertPodTransition(pod.status, "VERIFIED");
  if (pod.tripId && (await hasUnresolvedBadPodOnTrip(pod.tripId, pod.id))) {
    throw new Error(
      "Cannot verify while this trip has an unresolved bad POD; resolve via vendor debit note and mark as good"
    );
  }

  return completePodVerification(pod, charges, actor);
}

/** Mark a bad POD as good after an issued vendor debit note (same images, with client charges). */
export async function markBadPodAsGood(
  podId: string,
  actor?: SessionUser | null,
  charges: PodVerificationCharges = {}
) {
  const pod = await prisma.indentPod.findFirst({
    where: { id: podId },
    include: { indent: true, trip: { select: { id: true, vendorId: true } } },
  });
  if (!pod || pod.status !== "BAD_POD") return null;
  if (!isPodComplete(pod.fileId, pod.backFileId)) {
    throw new Error("Both front and back POD images are required");
  }
  const tripId = pod.tripId ?? pod.trip?.id;
  if (!tripId) throw new Error("Trip is required to mark bad POD as good");

  assertPodTransition(pod.status, "VERIFIED");
  await assertVendorDebitNoteGateForPod(tripId, pod.id);

  return completePodVerification(pod, charges, actor, { markBadPodResolved: true });
}

/** Reject a pending POD — creates a bad POD finance task with 24h SLA. */
export async function rejectPod(
  podId: string,
  rejectionReason: string | null,
  actor?: SessionUser | null
) {
  const pod = await prisma.indentPod.findFirst({
    where: { id: podId },
    include: {
      indent: true,
      trip: { select: { id: true, lrNumber: true, vendorId: true, vendor: { select: { name: true } } } },
    },
  });
  if (!pod) return null;

  assertPodTransition(pod.status, "BAD_POD");
  const now = new Date();
  const slaDeadlineAt = new Date(now.getTime() + POD_SLA_MS);

  await prisma.$transaction(async (tx) => {
    await tx.indentPod.update({
      where: { id: podId },
      data: {
        status: "BAD_POD",
        rejectionReason,
        rejectedAt: now,
        rejectedById: actor?.id ?? null,
        resolutionStatus: "PENDING",
        slaDeadlineAt,
      },
    });

    await tx.importantEvent.updateMany({
      where: {
        indentId: pod.indentId,
        type: "POD_PENDING",
        relatedEntityId: podId,
        status: "OPEN",
      },
      data: { status: "RESOLVED", resolvedAt: now, resolvedById: actor?.id ?? null },
    });
  });

  const { registerSlaTask } = await import("./sla.service");
  const { SLA_TYPES } = await import("../sla-types");
  await registerSlaTask({
    type: SLA_TYPES.BAD_POD,
    entityId: podId,
    startAt: now,
    deadlineAt: slaDeadlineAt,
    tripId: pod.tripId,
    indentId: pod.indentId,
  });

  const { createImportantEvent } = await import("./important-event.service");
  await createImportantEvent({
    type: "POD_REJECTED",
    severity: "CRITICAL",
    title: `Bad POD — ${pod.indent.indentNumber}`,
    description: rejectionReason,
    indentId: pod.indentId,
    relatedEntityId: podId,
    dueAt: slaDeadlineAt,
    targetTeamCode: "FINANCE",
  });

  if (pod.tripId && pod.trip) {
    const debitPath = buildDebitNoteDraftPath({
      tripId: pod.tripId,
      indentPodId: podId,
      vendorId: pod.trip.vendorId,
      indentId: pod.indentId,
    });
    const lr = pod.trip.lrNumber;
    const vendorName = pod.trip.vendor?.name ?? "vendor";
    await createImportantEvent({
      type: "POD_VENDOR_DEBIT_NOTE_REQUIRED",
      severity: "CRITICAL",
      title: `Vendor debit note required — ${lr}`,
      description: `Issue a vendor debit note for trip ${lr} (${vendorName}) before marking POD good. ${rejectionReason ?? ""} Create note: ${debitPath}`,
      indentId: pod.indentId,
      relatedEntityId: podId,
      dueAt: slaDeadlineAt,
      targetTeamCode: "FINANCE",
    });
  }

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.POD_VERIFICATION_FAILED,
    entity: "IndentPod",
    entityId: podId,
    meta: { rejectionReason },
  });

  return getPodById(podId);
}

/** Escalate bad PODs that remain unresolved after 24 hours. */
export async function escalateOverdueBadPods() {
  const now = new Date();
  const overdue = await prisma.indentPod.findMany({
    where: {
      status: "BAD_POD",
      resolutionStatus: "PENDING",
      slaDeadlineAt: { lt: now },
      escalatedAt: null,
    },
    include: {
      indent: { select: { indentNumber: true } },
      trip: { select: { lrNumber: true } },
    },
  });

  for (const pod of overdue) {
    await prisma.$transaction(async (tx) => {
      await tx.indentPod.update({
        where: { id: pod.id },
        data: {
          resolutionStatus: "SLA_BREACHED",
          slaBreachedAt: now,
          escalatedAt: now,
        },
      });
    });

    const { createImportantEvent } = await import("./important-event.service");
    await createImportantEvent({
      type: "POD_SLA_BREACHED",
      severity: "CRITICAL",
      title: `POD SLA breached — ${pod.indent.indentNumber}`,
      description: `Bad POD unresolved after 24 hours. Reason: ${pod.rejectionReason ?? "—"}${
        pod.trip ? ` · Trip ${pod.trip.lrNumber}` : ""
      }`,
      indentId: pod.indentId,
      relatedEntityId: pod.id,
      dueAt: pod.slaDeadlineAt,
    });

    const { notifyAdminUsers, notifyFinanceUsers } = await import("./sla-notify.service");
    await notifyFinanceUsers(
      `POD SLA breached: ${pod.indent.indentNumber} requires attention. Rejection reason: ${pod.rejectionReason ?? "—"}`,
      "INDENT_POD",
      pod.id
    );
    await notifyAdminUsers(
      `POD SLA breached: ${pod.indent.indentNumber} requires admin attention. Rejection reason: ${pod.rejectionReason ?? "—"}`,
      "INDENT_POD",
      pod.id
    );

    const { markSlaTaskBreached } = await import("./sla.service");
    const { SLA_TYPES } = await import("../sla-types");
    await markSlaTaskBreached(SLA_TYPES.BAD_POD, pod.id, now);

    await logAudit({
      action: AUDIT_ACTIONS.POD_SLA_BREACHED,
      entity: "IndentPod",
      entityId: pod.id,
      meta: { indentId: pod.indentId, rejectionReason: pod.rejectionReason },
    });
  }

  return overdue.length;
}

export async function getPodById(podId: string) {
  return prisma.indentPod.findFirst({
    where: { id: podId },
    include: POD_INCLUDE,
  });
}

/** PODs awaiting verification — visible to finance/admin. */
export async function listPendingVerificationPods(limit = 50) {
  await syncOrphanTripPodUploads();
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.BAD_POD]);
  return prisma.indentPod.findMany({
    where: { status: "PENDING_VERIFICATION" },
    orderBy: { uploadedAt: "asc" },
    take: limit,
    include: POD_INCLUDE,
  });
}

/** Bad POD tasks for finance — includes SLA-breached items. */
export async function listBadPodTasks(limit = 50) {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.BAD_POD]);
  return prisma.indentPod.findMany({
    where: {
      status: "BAD_POD",
      resolutionStatus: { in: ["PENDING", "SLA_BREACHED"] },
    },
    orderBy: [{ resolutionStatus: "desc" }, { rejectedAt: "asc" }],
    take: limit,
    include: POD_INCLUDE,
  });
}

export async function countPendingVerificationPods() {
  return prisma.indentPod.count({ where: { status: "PENDING_VERIFICATION" } });
}

export async function countBadPodTasks() {
  return prisma.indentPod.count({
    where: {
      status: "BAD_POD",
      resolutionStatus: { in: ["PENDING", "SLA_BREACHED"] },
    },
  });
}

/** @deprecated Use verifyPod(podId) — kept for indent-level review API compat. */
export async function approvePod(indentId: string, actor?: SessionUser | null) {
  const pending = await prisma.indentPod.findFirst({
    where: { indentId, status: "PENDING_VERIFICATION" },
    orderBy: { uploadedAt: "desc" },
  });
  if (!pending) return null;
  const result = await verifyPod(pending.id, actor, {});
  if (!result) return null;
  return (await import("./indent.service")).getIndentById(indentId);
}

/** @deprecated Use rejectPod(podId) — kept for indent-level review API compat. */
export async function rejectPodByIndent(
  indentId: string,
  remarks: string | null,
  actor?: SessionUser | null
) {
  const pending = await prisma.indentPod.findFirst({
    where: { indentId, status: "PENDING_VERIFICATION" },
    orderBy: { uploadedAt: "desc" },
  });
  if (!pending) return null;
  const result = await rejectPod(pending.id, remarks, actor);
  if (!result) return null;
  return (await import("./indent.service")).getIndentById(indentId);
}
