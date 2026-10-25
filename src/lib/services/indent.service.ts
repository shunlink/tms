import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { nextNumber } from "../sequence";
import { indentFullInclude } from "../prisma/includes";
import { mapIndentToFlat, mapIndentListItem, type IndentWithRelations } from "../mappers/indent";
import type { IndentInput } from "../validation";
import { ewayBillToPrismaData } from "../integrations/ewaybill/service";
import { assertTransition } from "../indent-states";
import { invalidateDashboardCache } from "../invalidate-dashboard-cache";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";

function parseDateTime(
  dateStr?: string | Date | null,
  timeStr?: string | null
): Date | undefined {
  if (!dateStr) return undefined;
  if (dateStr instanceof Date) {
    const d = new Date(dateStr);
    if (timeStr) {
      const [h, m] = timeStr.split(":").map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
    }
    return d;
  }
  const t = timeStr?.trim() || "00:00";
  const iso = `${dateStr}T${t}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(dateStr) : d;
}

function buildConsignmentData(input: IndentInput) {
  return {
    serviceType: input.serviceType ?? "GTA",
    transactionType: input.transactionType ?? "SPOT",
    vehicleTypeCode: input.vehicleType,
    bodyTypeCode: input.bodyType || null,
    vehicleQuantity: input.quantity ?? 1,
    insuranceType: input.insuranceType ?? "NONE",
    cargoTypeCode: input.cargoType ?? "GENERAL",
    weightValue: input.weightValue ?? input.weightKg ?? null,
    weightUnit: input.weightUnit ?? (input.weightKg != null ? "KG" : "MT"),
    packageCount: input.packageCount ?? null,
    capacityCbm: input.capacityCbm ?? null,
    pickupAt: parseDateTime(input.pickupDate, input.pickupTime),
    deliveryAt: parseDateTime(input.deliveryDate, input.deliveryTime),
    podDueAt: input.podDueAt ? new Date(input.podDueAt) : undefined,
    ewayBillRequired: input.ewayBillRequired ?? false,
    specialInstructions: input.specialInstructions || null,
  };
}

export async function listIndents(filters?: { status?: string }) {
  const rows = await prisma.indent.findMany({
    where: filters?.status ? { status: filters.status } : {},
    orderBy: { createdAt: "desc" },
    take: 500,
    include: indentFullInclude,
  });
  return rows.map(mapIndentListItem);
}

export async function getIndentById(id: string) {
  await import("../indent-line-sync").then((m) => m.reconcileIndentLines(id));
  const row = await prisma.indent.findFirst({
    where: { id },
    include: indentFullInclude,
  });
  if (!row) return null;
  const flat = mapIndentToFlat(row);
  const docs = await prisma.documentAttachment.findMany({
    where: { entityType: "INDENT", entityId: id },
    include: { file: true },
    orderBy: { createdAt: "desc" },
  });
  flat.documents = docs.map((d) => ({
    id: d.id,
    type: d.documentType,
    url: d.file.url,
    name: d.title ?? d.file.fileName,
    createdAt: d.createdAt.toISOString(),
  }));
  return flat;
}

export async function createIndent(
  input: IndentInput & { requirementId?: string | null },
  createdById?: string | null
) {
  if (input.requirementId) {
    const req = await prisma.requirement.findFirst({
      where: { id: input.requirementId },
      include: { indent: true },
    });
    if (!req) throw new Error("Requirement not found");
    if (req.status === "CANCELLED") throw new Error("Requirement is cancelled");
    if (req.status === "CONVERTED" && req.indent) {
      throw new Error("Requirement already converted to an indent");
    }
  }

  const indentNumber = await nextNumber("IND");
  const qty = input.quantity ?? 1;
  const fromRequirement = Boolean(input.requirementId);

  const indent = await prisma.$transaction(async (tx) => {
    const created = await tx.indent.create({
      data: {
        indentNumber,
        clientId: input.clientId,
        requirementId: input.requirementId ?? null,
        indentDate: input.indentDate ? new Date(input.indentDate) : new Date(),
        status: "DRAFT",
        source: fromRequirement ? "REQUIREMENT" : "ADMIN",
        createdById: createdById ?? null,
        remarks: input.remarks || null,
        consignment: { create: buildConsignmentData(input) },
        loading: {
          create: {
            partyName: input.consignorName || null,
            gstin: input.consignorGstin || null,
            contactName: input.consignorContact || null,
            phone: input.consignorPhone || null,
            addressLine1: input.consignorAddress || null,
            city: input.consignorCity || null,
            state: input.consignorState || null,
            pincode: input.consignorPincode || null,
          },
        },
        unloading: {
          create: {
            partyName: input.consigneeName || null,
            gstin: input.consigneeGstin || null,
            contactName: input.consigneeContact || null,
            phone: input.consigneePhone || null,
            addressLine1: input.consigneeAddress || null,
            city: input.consigneeCity || null,
            state: input.consigneeState || null,
            pincode: input.consigneePincode || null,
          },
        },
        cargo: {
          create: {
            description: input.materialDescription || null,
            packingType: input.packingType || null,
            hsnCode: input.hsnCode || null,
            declaredValue: input.materialValue ?? null,
            invoiceNumber: input.invoiceNumber || null,
            invoiceValue: input.invoiceValue ?? null,
          },
        },
        clientFreight: {
          create: {
            clientRate: input.clientRate ?? null,
            freightType: input.freightType || "FOR",
            paymentMode: input.paymentMode || "TBB",
          },
        },
        ...(input.ewayBill
          ? {
              ewayBill: {
                create: ewayBillToPrismaData({
                  mode: input.ewayBill.mode ?? "MANUAL",
                  ewayBillNumber: input.ewayBill.ewayBillNumber ?? undefined,
                  status: input.ewayBill.status ?? undefined,
                  supplierGstin: input.ewayBill.supplierGstin ?? undefined,
                  recipientGstin: input.ewayBill.recipientGstin ?? undefined,
                  documentType: input.ewayBill.documentType ?? undefined,
                  documentNumber: input.ewayBill.documentNumber ?? undefined,
                  documentDate: input.ewayBill.documentDate ?? undefined,
                  goodsDescription: input.ewayBill.goodsDescription ?? undefined,
                  hsnCode: input.ewayBill.hsnCode ?? undefined,
                  quantity: input.ewayBill.quantity ?? undefined,
                  value: input.ewayBill.value ?? undefined,
                  origin: input.ewayBill.origin ?? undefined,
                  destination: input.ewayBill.destination ?? undefined,
                  transporterName: input.ewayBill.transporterName ?? undefined,
                  transporterGstin: input.ewayBill.transporterGstin ?? undefined,
                  vehicleNumber: input.ewayBill.vehicleNumber ?? undefined,
                  validFrom: input.ewayBill.validFrom ?? undefined,
                  validUntil: input.ewayBill.validUntil ?? undefined,
                  provider: input.ewayBill.provider ?? undefined,
                  fetchedAt: input.ewayBill.fetchedAt ?? undefined,
                  source: input.ewayBill.source ?? "MANUAL",
                }),
              },
            }
          : {}),
      },
    });

    await createIndentLines(tx, created.id, qty, input.vehicleType, input.bodyType);

    if (input.requirementId) {
      await tx.requirement.update({
        where: { id: input.requirementId },
        data: { status: "CONVERTED", convertedAt: new Date() },
      });
    }

    return created;
  });

  await logAudit({
    user: { id: createdById ?? undefined } as SessionUser,
    action: fromRequirement ? "indent.created_from_requirement" : "indent.created",
    entity: "INDENT",
    entityId: indent.id,
    meta: { indentNumber, requirementId: input.requirementId ?? null },
  });

  return getIndentById(indent.id);
}

async function createIndentLines(
  tx: Prisma.TransactionClient,
  indentId: string,
  quantity: number,
  vehicleTypeCode: string,
  bodyTypeCode?: string | null
) {
  for (let n = 1; n <= quantity; n++) {
    await tx.indentLine.create({
      data: {
        indentId,
        lineNumber: n,
        vehicleTypeCode,
        bodyTypeCode: bodyTypeCode || null,
      },
    });
  }
}

async function syncIndentLineQuantity(
  tx: Prisma.TransactionClient,
  indentId: string,
  quantity: number,
  vehicleTypeCode?: string,
  bodyTypeCode?: string | null
) {
  const qty = Math.max(1, quantity);
  const indent = await tx.indent.findFirst({
    where: { id: indentId },
    include: {
      consignment: { select: { vehicleTypeCode: true, bodyTypeCode: true } },
      lines: { orderBy: { lineNumber: "asc" } },
    },
  });
  if (!indent) return;

  const vType = vehicleTypeCode ?? indent.consignment?.vehicleTypeCode ?? "TRUCK_17FT";
  const bType = bodyTypeCode ?? indent.consignment?.bodyTypeCode ?? null;
  const lines = indent.lines;

  if (lines.length < qty) {
    for (let n = lines.length + 1; n <= qty; n++) {
      await tx.indentLine.create({
        data: {
          indentId,
          lineNumber: n,
          vehicleTypeCode: vType,
          bodyTypeCode: bType,
        },
      });
    }
    return;
  }

  if (lines.length > qty) {
    const extras = lines.filter((l) => l.lineNumber > qty);
    for (const line of extras) {
      if (line.tripId) {
        throw new Error("Cannot reduce vehicle count after trips have been created");
      }
      if (line.status !== "OPEN" && line.status !== "CANCELLED") {
        throw new Error("Cannot reduce vehicle count: remove allocated slots first");
      }
      await tx.indentAllocation.deleteMany({ where: { indentLineId: line.id } });
      await tx.indentLine.delete({ where: { id: line.id } });
    }
  }
}

/** Convert a client requirement into an indent draft (requirement data prefilled). */
export async function createIndentFromRequirement(requirementId: string, createdById?: string | null) {
  const req = await prisma.requirement.findFirst({
    where: { id: requirementId },
    include: { client: true, indent: true },
  });
  if (!req) throw new Error("Requirement not found");
  if (req.status === "CONVERTED" && req.indent) return getIndentById(req.indent.id);
  if (req.status === "CANCELLED") throw new Error("Requirement is cancelled");

  const indentNumber = await nextNumber("IND");
  const qty = req.vehicleQuantity ?? 1;

  const indent = await prisma.$transaction(async (tx) => {
    const created = await tx.indent.create({
      data: {
        indentNumber,
        clientId: req.clientId,
        requirementId: req.id,
        indentDate: new Date(),
        status: "DRAFT",
        source: "REQUIREMENT",
        createdById: createdById ?? null,
        consignment: {
          create: {
            serviceType: "GTA",
            transactionType: "SPOT",
            vehicleTypeCode: req.vehicleTypeCode,
            bodyTypeCode: req.bodyTypeCode,
            vehicleQuantity: qty,
            insuranceType: req.insuranceType ?? "NONE",
            cargoTypeCode: req.cargoTypeCode ?? "GENERAL",
            capacityCbm: req.capacityCbm,
            weightValue: req.weightValue,
            weightUnit: req.weightUnit ?? "MT",
            packageCount: req.packageCount,
            pickupAt: req.pickupAt ?? req.expectedAt,
            deliveryAt: req.deliveryAt,
            specialInstructions: req.specialInstructions,
          },
        },
        loading: {
          create: {
            partyName: req.consignorName || req.client.name,
            contactName: req.consignorContact,
            phone: req.consignorPhone,
            addressLine1: req.consignorAddress || req.routeFrom,
            city: req.consignorCity || req.routeFrom,
            state: req.consignorState,
            pincode: req.consignorPincode,
          },
        },
        unloading: {
          create: {
            partyName: req.consigneeName,
            contactName: req.consigneeContact,
            phone: req.consigneePhone,
            addressLine1: req.consigneeAddress || req.routeTo,
            city: req.consigneeCity || req.routeTo,
            state: req.consigneeState,
            pincode: req.consigneePincode,
          },
        },
        cargo: {
          create: {
            description: req.materialDescription || req.cargoSummary,
            packingType: req.packingType,
            hsnCode: req.hsnCode,
            declaredValue: req.materialValue,
          },
        },
        clientFreight: {
          create: {
            clientRate: req.clientRate,
            freightType: req.freightType || "FOR",
            paymentMode: req.paymentMode || "TBB",
          },
        },
      },
    });

    for (let n = 1; n <= qty; n++) {
      await tx.indentLine.create({
        data: {
          indentId: created.id,
          lineNumber: n,
          vehicleTypeCode: req.vehicleTypeCode,
        },
      });
    }

    await tx.requirement.update({
      where: { id: req.id },
      data: { status: "CONVERTED", convertedAt: new Date() },
    });

    return created;
  });

  await logAudit({
    user: { id: createdById ?? undefined } as SessionUser,
    action: "indent.created_from_requirement",
    entity: "INDENT",
    entityId: indent.id,
    meta: { indentNumber, requirementId },
  });

  return getIndentById(indent.id);
}

/** Progressive edit of the same indent (different roles edit different sections). */
export async function updateIndent(id: string, input: Partial<IndentInput>) {
  const existing = await prisma.indent.findFirst({ where: { id } });
  if (!existing) return null;

  await prisma.$transaction(async (tx) => {
    if (input.remarks !== undefined) {
      await tx.indent.update({ where: { id }, data: { remarks: input.remarks || null } });
    }

    const consignmentPatch: Record<string, unknown> = {};
    if (input.vehicleType) consignmentPatch.vehicleTypeCode = input.vehicleType;
    if (input.bodyType !== undefined) consignmentPatch.bodyTypeCode = input.bodyType || null;
    if (input.quantity) consignmentPatch.vehicleQuantity = input.quantity;
    if (input.serviceType) consignmentPatch.serviceType = input.serviceType;
    if (input.transactionType) consignmentPatch.transactionType = input.transactionType;
    if (input.insuranceType) consignmentPatch.insuranceType = input.insuranceType;
    if (input.cargoType) consignmentPatch.cargoTypeCode = input.cargoType;
    if (input.weightValue != null || input.weightKg != null) {
      consignmentPatch.weightValue = input.weightValue ?? input.weightKg;
      consignmentPatch.weightUnit = input.weightUnit ?? "MT";
    }
    if (input.packageCount != null) consignmentPatch.packageCount = input.packageCount;
    if (input.capacityCbm != null) consignmentPatch.capacityCbm = input.capacityCbm;
    if (input.pickupDate) {
      consignmentPatch.pickupAt = parseDateTime(input.pickupDate, input.pickupTime);
    }
    if (input.deliveryDate) {
      consignmentPatch.deliveryAt = parseDateTime(input.deliveryDate, input.deliveryTime);
    }
    if (input.podDueAt) consignmentPatch.podDueAt = new Date(input.podDueAt);
    if (input.ewayBillRequired != null) consignmentPatch.ewayBillRequired = input.ewayBillRequired;
    if (input.specialInstructions !== undefined) {
      consignmentPatch.specialInstructions = input.specialInstructions || null;
    }
    if (Object.keys(consignmentPatch).length) {
      await tx.indentConsignment.update({ where: { indentId: id }, data: consignmentPatch });
    }

    if (input.quantity != null) {
      await syncIndentLineQuantity(tx, id, input.quantity, input.vehicleType, input.bodyType);
    }

    if (input.clientRate != null || input.freightType || input.paymentMode) {
      await tx.indentClientFreight.update({
        where: { indentId: id },
        data: {
          ...(input.clientRate != null ? { clientRate: input.clientRate } : {}),
          ...(input.freightType ? { freightType: input.freightType } : {}),
          ...(input.paymentMode ? { paymentMode: input.paymentMode } : {}),
        },
      });
    }

    if (input.indentDate) {
      await tx.indent.update({ where: { id }, data: { indentDate: new Date(input.indentDate) } });
    }

    const loadingPatch: Record<string, unknown> = {};
    if (input.consignorName !== undefined) loadingPatch.partyName = input.consignorName || null;
    if (input.consignorGstin !== undefined) loadingPatch.gstin = input.consignorGstin || null;
    if (input.consignorContact !== undefined) loadingPatch.contactName = input.consignorContact || null;
    if (input.consignorPhone !== undefined) loadingPatch.phone = input.consignorPhone || null;
    if (input.consignorAddress !== undefined) loadingPatch.addressLine1 = input.consignorAddress || null;
    if (input.consignorCity !== undefined) loadingPatch.city = input.consignorCity || null;
    if (input.consignorState !== undefined) loadingPatch.state = input.consignorState || null;
    if (input.consignorPincode !== undefined) loadingPatch.pincode = input.consignorPincode || null;
    if (Object.keys(loadingPatch).length) {
      await tx.indentLoadingLocation.update({ where: { indentId: id }, data: loadingPatch });
    }

    const unloadingPatch: Record<string, unknown> = {};
    if (input.consigneeName !== undefined) unloadingPatch.partyName = input.consigneeName || null;
    if (input.consigneeGstin !== undefined) unloadingPatch.gstin = input.consigneeGstin || null;
    if (input.consigneeContact !== undefined) unloadingPatch.contactName = input.consigneeContact || null;
    if (input.consigneePhone !== undefined) unloadingPatch.phone = input.consigneePhone || null;
    if (input.consigneeAddress !== undefined) unloadingPatch.addressLine1 = input.consigneeAddress || null;
    if (input.consigneeCity !== undefined) unloadingPatch.city = input.consigneeCity || null;
    if (input.consigneeState !== undefined) unloadingPatch.state = input.consigneeState || null;
    if (input.consigneePincode !== undefined) unloadingPatch.pincode = input.consigneePincode || null;
    if (Object.keys(unloadingPatch).length) {
      await tx.indentUnloadingLocation.update({ where: { indentId: id }, data: unloadingPatch });
    }

    const cargoPatch: Record<string, unknown> = {};
    if (input.materialDescription !== undefined) cargoPatch.description = input.materialDescription || null;
    if (input.packingType !== undefined) cargoPatch.packingType = input.packingType || null;
    if (input.hsnCode !== undefined) cargoPatch.hsnCode = input.hsnCode || null;
    if (input.materialValue != null) cargoPatch.declaredValue = input.materialValue;
    if (input.invoiceNumber !== undefined) cargoPatch.invoiceNumber = input.invoiceNumber || null;
    if (input.invoiceValue != null) cargoPatch.invoiceValue = input.invoiceValue;
    if (Object.keys(cargoPatch).length) {
      await tx.indentCargo.update({ where: { indentId: id }, data: cargoPatch });
    }

    if (input.ewayBill) {
      const ewbData = ewayBillToPrismaData({
        mode: input.ewayBill.mode ?? "MANUAL",
        ewayBillNumber: input.ewayBill.ewayBillNumber ?? undefined,
        status: input.ewayBill.status ?? undefined,
        supplierGstin: input.ewayBill.supplierGstin ?? undefined,
        recipientGstin: input.ewayBill.recipientGstin ?? undefined,
        documentType: input.ewayBill.documentType ?? undefined,
        documentNumber: input.ewayBill.documentNumber ?? undefined,
        documentDate: input.ewayBill.documentDate ?? undefined,
        goodsDescription: input.ewayBill.goodsDescription ?? undefined,
        hsnCode: input.ewayBill.hsnCode ?? undefined,
        quantity: input.ewayBill.quantity ?? undefined,
        value: input.ewayBill.value ?? undefined,
        origin: input.ewayBill.origin ?? undefined,
        destination: input.ewayBill.destination ?? undefined,
        transporterName: input.ewayBill.transporterName ?? undefined,
        transporterGstin: input.ewayBill.transporterGstin ?? undefined,
        vehicleNumber: input.ewayBill.vehicleNumber ?? undefined,
        validFrom: input.ewayBill.validFrom ?? undefined,
        validUntil: input.ewayBill.validUntil ?? undefined,
        provider: input.ewayBill.provider ?? undefined,
        fetchedAt: input.ewayBill.fetchedAt ?? undefined,
        source: input.ewayBill.source ?? "MANUAL",
      });
      await tx.indentEwayBill.upsert({
        where: { indentId: id },
        create: { indentId: id, ...ewbData },
        update: ewbData,
      });
    }
  });

  return getIndentById(id);
}

/** Load requirement data for indent form prefill (no indent created). */
export async function getRequirementPrefill(requirementId: string) {
  const req = await prisma.requirement.findFirst({
    where: { id: requirementId },
    include: { client: true, indent: true },
  });
  if (!req) return null;
  if (req.status === "CANCELLED") return null;
  const { mapRequirementToIndentFormValues } = await import("../mappers/requirement-to-indent");
  return {
    requirementId: req.id,
    reqNumber: req.reqNumber,
    status: req.status,
    alreadyConverted: req.status === "CONVERTED",
    indentId: req.indent?.id ?? null,
    clientId: req.clientId,
    clientName: req.client.name,
    values: mapRequirementToIndentFormValues(req),
  };
}

/** Move a draft to the finance advance queue. */
export async function submitForAdvance(id: string, user?: SessionUser) {
  const indent = await prisma.indent.findFirst({ where: { id } });
  if (!indent) return null;
  assertTransition(indent.status, "WAITING_FOR_ADVANCE");

  await prisma.indent.update({ where: { id }, data: { status: "WAITING_FOR_ADVANCE" } });

  const { createImportantEvent } = await import("./important-event.service");
  await createImportantEvent({
    type: "ADVANCE_PENDING",
    severity: "WARNING",
    title: `Advance decision pending for ${indent.indentNumber}`,
    indentId: id,
  });

  await logAudit({
    user,
    action: "indent.submitted_for_advance",
    entity: "INDENT",
    entityId: id,
  });

  return getIndentById(id);
}

/** Release the indent to vendors in admin-selected cities. */
export async function releaseIndentToVendors(
  id: string,
  cities: string[],
  zones: string[] = [],
  user?: SessionUser
) {
  const { releaseIndentToCities } = await import("./release.service");
  const result = await releaseIndentToCities(id, cities, zones, user);
  if (!result) return null;
  return getIndentById(id);
}

/** Cancel an indent (soft; history preserved). */
export async function cancelIndent(id: string, user?: SessionUser) {
  const indent = await prisma.indent.findFirst({ where: { id } });
  if (!indent) return null;
  assertTransition(indent.status, "CANCELLED");

  await prisma.indent.update({ where: { id }, data: { status: "CANCELLED" } });

  const { syncTripFromIndent } = await import("../vendor-trip-sync");
  await syncTripFromIndent(id);

  const openBadPods = await prisma.indentPod.findMany({
    where: { indentId: id, status: "BAD_POD", resolutionStatus: { not: "CORRECTED" } },
    select: { id: true },
  });
  if (openBadPods.length) {
    const { cancelSlaTask } = await import("./sla.service");
    const { SLA_TYPES } = await import("../sla-types");
    for (const pod of openBadPods) await cancelSlaTask(SLA_TYPES.BAD_POD, pod.id);
  }

  const { dismissIndentEvents } = await import("./important-event.service");
  await dismissIndentEvents(id);

  await invalidateDashboardCache();
  await logAudit({ user, action: "indent.cancelled", entity: "INDENT", entityId: id });
  return getIndentById(id);
}

/** Transition helper for execution-stage updates (in transit, delivered). */
export async function transitionIndent(id: string, to: string, user?: SessionUser) {
  const indent = await prisma.indent.findFirst({ where: { id } });
  if (!indent) return null;
  assertTransition(indent.status, to);

  if (to === "IN_TRANSIT" && indent.vendorId) {
    const trip = await prisma.trip.findFirst({
      where: { indentId: id },
      select: { id: true },
    });
    if (!trip) throw new Error("Create trip before starting transit");

    const { checkIndentTripReadiness } = await import("../integrations/trip-readiness");
    const readiness = await checkIndentTripReadiness(id);
    if (!readiness.ready) {
      throw new Error(`Cannot start trip: ${readiness.reasons.join("; ")}`);
    }
  }

  const data: Record<string, unknown> = { status: to };
  if (to === "IN_TRANSIT" || to === "DELIVERED" || to === "POD_PENDING") {
    // no extra timestamps on indent; the trip child record captures these
  }

  await prisma.indent.update({ where: { id }, data });
  const { syncTripFromIndent } = await import("../vendor-trip-sync");
  await syncTripFromIndent(id);
  await invalidateDashboardCache();
  await logAudit({ user, action: `indent.${to.toLowerCase()}`, entity: "INDENT", entityId: id });
  return getIndentById(id);
}

export async function completeIndent(id: string, user?: SessionUser) {
  const indent = await prisma.indent.findFirst({ where: { id } });
  if (!indent) return null;
  assertTransition(indent.status, "COMPLETED");

  await prisma.indent.update({ where: { id }, data: { status: "COMPLETED" } });
  await invalidateDashboardCache();
  await logAudit({ user, action: "indent.completed", entity: "INDENT", entityId: id });
  return getIndentById(id);
}
