import type { Prisma } from "@prisma/client";
import {
  isVendorAdvancePaidStatus,
  resolveIndentAdvanceAmount,
  resolveTripVendorAdvance,
} from "../advance";
import { indentFullInclude } from "../prisma/includes";

export type IndentWithRelations = Prisma.IndentGetPayload<{
  include: typeof indentFullInclude;
}>;

const n = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

function splitDateTime(dt: Date | null | undefined) {
  if (!dt) return { date: null as Date | null, time: null as string | null };
  const hours = dt.getHours().toString().padStart(2, "0");
  const mins = dt.getMinutes().toString().padStart(2, "0");
  return { date: dt, time: `${hours}:${mins}` };
}

function weightToKg(value: Prisma.Decimal | null | undefined, unit: string | null | undefined) {
  const v = n(value);
  if (!v) return 0;
  return unit === "MT" ? v * 1000 : v;
}

function activeAllocation(i: IndentWithRelations) {
  for (const line of i.lines) {
    const active = line.allocations.find((a) => a.status === "ACTIVE");
    if (active) return active;
  }
  return null;
}

function mapVehicleSlots(i: IndentWithRelations) {
  return i.lines.map((line) => {
    const alloc = line.allocations.find((a) => a.status === "ACTIVE") ?? null;
    return {
      lineId: line.id,
      lineNumber: line.lineNumber,
      lineStatus: line.status,
      placementStatus: line.placementStatus,
      placementReachedAt: line.placementReachedAt,
      trip: line.trip
        ? { id: line.trip.id, lrNumber: line.trip.lrNumber, status: line.trip.status }
        : null,
      vehicle: alloc?.vehicle
        ? {
            id: alloc.vehicle.id,
            registrationNumber: alloc.vehicle.registrationNumber,
          }
        : null,
      driver: alloc?.driver
        ? {
            id: alloc.driver.id,
            name: alloc.driver.name,
            phone: alloc.driver.phone,
            dlNumber: alloc.driver.dlNumber,
            deviceType: alloc.driver.deviceType,
            otpVerified: alloc.driver.otpVerified,
          }
        : null,
      allocation: alloc
        ? {
            id: alloc.id,
            vendorId: alloc.vendorId,
            vendorRate: n(alloc.vendorRate),
            vehicleId: alloc.vehicleId,
            driverId: alloc.driverId,
          }
        : null,
    };
  });
}

function paymentOfType(i: IndentWithRelations, type: string) {
  return i.payments.find((p) => p.paymentType === type) ?? null;
}

function activeQuotes(i: IndentWithRelations) {
  return i.quotes.filter((q) => q.status === "ACTIVE" || q.status === "ACCEPTED");
}

/** Flat view for existing UI components and API consumers */
export function mapIndentToFlat(i: IndentWithRelations) {
  const c = i.consignment;
  const load = i.loading;
  const unload = i.unloading;
  const cargo = i.cargo;
  const freight = i.clientFreight;
  const alloc = activeAllocation(i);
  const advance = paymentOfType(i, "ADVANCE");
  const tripRow = i.trips[0] ?? null;
  const tripAdvance = resolveTripVendorAdvance(tripRow?.advanceRequests);
  const confirmedAdvance = tripAdvance
    ? (tripAdvance.paidAmount ?? 0)
    : (resolveIndentAdvanceAmount(i) ?? 0);
  const balanceTask = tripRow?.balancePaymentTask ?? null;
  const remainingVendorPayable = balanceTask
    ? Math.max(0, n(balanceTask.balanceAmount) - n(balanceTask.paidAmount))
    : Math.max(0, n(alloc?.vendorRate) - confirmedAdvance);
  const balance = paymentOfType(i, "BALANCE");
  const quotes = activeQuotes(i);
  const bestQuote = quotes[0];
  const pickup = splitDateTime(c?.pickupAt);
  const delivery = splitDateTime(c?.deliveryAt);
  const lastPing = i.trackingPings[0];

  return {
    id: i.id,
    indentNumber: i.indentNumber,
    status: i.status,
    source: i.source ?? "ADMIN",
    biddingLoadRequirementId: i.biddingLoadRequirementId ?? null,
    allocationMode: i.allocationMode ?? "BIDDING",
    indentDate: i.indentDate,
    remarks: i.remarks,
    client: i.client,
    requirementId: i.requirementId ?? null,
    requirementNumber: i.requirement?.reqNumber ?? null,
    // consignor
    consignorName: load?.partyName ?? null,
    consignorAddress: load?.addressLine1 ?? null,
    consignorCity: load?.city ?? null,
    consignorState: load?.state ?? null,
    consignorPincode: load?.pincode ?? null,
    consignorGstin: load?.gstin ?? null,
    consignorContact: load?.contactName ?? null,
    consignorPhone: load?.phone ?? null,
    pickupDate: pickup.date,
    pickupTime: pickup.time,
    // consignee
    consigneeName: unload?.partyName ?? null,
    consigneeAddress: unload?.addressLine1 ?? null,
    consigneeCity: unload?.city ?? null,
    consigneeState: unload?.state ?? null,
    consigneePincode: unload?.pincode ?? null,
    consigneeGstin: unload?.gstin ?? null,
    consigneeContact: unload?.contactName ?? null,
    consigneePhone: unload?.phone ?? null,
    deliveryDate: delivery.date,
    deliveryTime: delivery.time,
    // consignment
    serviceType: c?.serviceType ?? "GTA",
    transactionType: c?.transactionType ?? "SPOT",
    insuranceType: c?.insuranceType ?? "NONE",
    cargoType: c?.cargoTypeCode ?? null,
    vehicleType: c?.vehicleTypeCode ?? "TRUCK_17FT",
    bodyType: c?.bodyTypeCode ?? null,
    quantity: c?.vehicleQuantity ?? 1,
    capacityCbm: n(c?.capacityCbm),
    podDueAt: c?.podDueAt ?? null,
    // material
    materialDescription: cargo?.description ?? null,
    packingType: cargo?.packingType ?? null,
    packageCount: c?.packageCount ?? null,
    weightKg: weightToKg(c?.weightValue, c?.weightUnit),
    weightValue: n(c?.weightValue),
    weightUnit: c?.weightUnit ?? "MT",
    materialValue: n(cargo?.declaredValue),
    hsnCode: cargo?.hsnCode ?? null,
    invoiceNumber: cargo?.invoiceNumber ?? null,
    invoiceValue: n(cargo?.invoiceValue),
    // freight
    clientRate: n(freight?.clientRate),
    vendorRate: n(alloc?.vendorRate),
    bestQuoteRate: bestQuote ? n(bestQuote.quotedRate) : 0,
    bestQuoteVendor: bestQuote?.vendor?.name ?? null,
    freightType: freight?.freightType ?? null,
    paymentMode: freight?.paymentMode ?? null,
    ewayBillRequired: c?.ewayBillRequired ?? false,
    ewayBill: i.ewayBill
      ? {
          mode: i.ewayBill.mode,
          ewayBillNumber: i.ewayBill.ewayBillNumber,
          status: i.ewayBill.status,
          supplierGstin: i.ewayBill.supplierGstin,
          recipientGstin: i.ewayBill.recipientGstin,
          documentType: i.ewayBill.documentType,
          documentNumber: i.ewayBill.documentNumber,
          documentDate: i.ewayBill.documentDate,
          goodsDescription: i.ewayBill.goodsDescription,
          hsnCode: i.ewayBill.hsnCode,
          quantity: i.ewayBill.quantity,
          value: n(i.ewayBill.value),
          origin: i.ewayBill.origin,
          destination: i.ewayBill.destination,
          transporterName: i.ewayBill.transporterName,
          transporterGstin: i.ewayBill.transporterGstin,
          vehicleNumber: i.ewayBill.vehicleNumber,
          validFrom: i.ewayBill.validFrom,
          validUntil: i.ewayBill.validUntil,
          provider: i.ewayBill.provider,
          fetchedAt: i.ewayBill.fetchedAt,
          source: i.ewayBill.source,
        }
      : null,
    specialInstructions: c?.specialInstructions ?? null,
    // advance — trip AdvanceRequest is authoritative; indent fields are legacy fallback
    advanceSource: tripAdvance ? ("TRIP" as const) : ("INDENT" as const),
    advanceRequestNumber: tripAdvance?.requestNumber ?? null,
    advanceStatus: tripAdvance?.status ?? i.advanceStatus ?? "PENDING",
    advanceRequested: tripAdvance ? (tripAdvance.requestedAmount ?? 0) : n(i.advanceRequested),
    advanceApproved: tripAdvance ? (tripAdvance.approvedAmount ?? 0) : n(i.advanceApproved),
    advanceAmount: confirmedAdvance,
    advanceOutstanding: tripAdvance?.outstandingAmount ?? null,
    advanceMode: tripAdvance ? tripAdvance.paymentMethod : (advance?.mode ?? null),
    advanceReference: tripAdvance ? tripAdvance.utrReference : (advance?.referenceNo ?? null),
    advancePaidAt: tripAdvance
      ? tripAdvance.paymentDate
      : (advance?.paidAt ?? (isVendorAdvancePaidStatus(i.advanceStatus) ? i.updatedAt : null)),
    advanceRecordedBy: tripAdvance ? tripAdvance.recordedBy : (advance?.recordedBy?.name ?? null),
    advanceExternalProvider: tripAdvance?.externalProvider ?? null,
    remainingVendorPayable,
    releasedAt: i.releasedAt ?? null,
    releaseCities: i.releaseCities?.map((r) => r.city) ?? [],
    paymentHistory: i.payments.map((p) => ({
      id: p.id,
      paymentType: p.paymentType,
      amount: n(p.amount),
      mode: p.mode,
      referenceNo: p.referenceNo,
      paidAt: p.paidAt,
      recordedBy: p.recordedBy?.name ?? null,
    })),
    // allocation
    vendorId: i.vendorId ?? null,
    vehicleId: i.vehicleId ?? null,
    driverId: i.driverId ?? null,
    vendor: i.vendor,
    vehicle: i.vehicle,
    driver: i.driver,
    allocationStatus: alloc?.status ?? null,
    allocatedAt: alloc?.allocatedAt ?? i.vendorAllocatedAt ?? null,
    vendorAllocatedAt: i.vendorAllocatedAt ?? null,
    allocatedBy: alloc?.allocatedBy
      ? { id: alloc.allocatedBy.id, name: alloc.allocatedBy.name, email: alloc.allocatedBy.email }
      : null,
    deadlineAt: alloc?.deadlineAt ?? i.placementDeadlineAt ?? null,
    placementStatus: i.placementStatus ?? null,
    placementDeadlineAt: i.placementDeadlineAt ?? null,
    allocations: i.lines.flatMap((line) =>
      line.allocations.map((a) => ({
        id: a.id,
        indentLineId: line.id,
        lineNumber: line.lineNumber,
        vendorId: a.vendorId,
        vendorName: a.vendor?.name ?? null,
        vendorRate: n(a.vendorRate),
        status: a.status,
        allocatedAt: a.allocatedAt,
        deadlineAt: a.deadlineAt,
        reallocatedAt: a.reallocatedAt,
        reallocationReason: a.reallocationReason,
        vehicleId: a.vehicleId,
        driverId: a.driverId,
        vehicleRegistration: a.vehicle?.registrationNumber ?? null,
        driverName: a.driver?.name ?? null,
        driverDlNumber: a.driver?.dlNumber ?? null,
      }))
    ),
    vehicleSlots: mapVehicleSlots(i),
    trips: i.trips.map((t) => ({ id: t.id, lrNumber: t.lrNumber, status: t.status })),
    quotes: quotes.map((q) => ({
      id: q.id,
      vendorId: q.vendorId,
      vendorName: q.vendor?.name ?? null,
      vendorPhone: q.vendor?.phone ?? null,
      vendorRating: q.vendor?.rating ? q.vendor.rating.toNumber() : null,
      quotedRate: n(q.quotedRate),
      channel: q.channel,
      status: q.status,
      remarks: q.remarks,
      submittedAt: q.submittedAt,
    })),
    // POD + completion
    podReceivedAt: i.podReceivedAt,
    balanceAmount: n(balance?.amount),
    balanceMode: balance?.mode ?? null,
    balanceReference: balance?.referenceNo ?? null,
    balancePaidAt: balance?.paidAt ?? null,
    pods: i.pods.map((p) => ({
      id: p.id,
      tripId: p.tripId,
      url: p.file?.url ?? null,
      backUrl: p.backFile?.url ?? null,
      source: p.source,
      status: p.status,
      remarks: p.remarks,
      uploadedAt: p.uploadedAt,
      uploadedBy: p.uploadedBy?.name ?? null,
      verifiedAt: p.verifiedAt,
      verifiedBy: p.verifiedBy?.name ?? null,
      rejectionReason: p.rejectionReason,
      rejectedAt: p.rejectedAt,
      rejectedBy: p.rejectedBy?.name ?? null,
      resolutionStatus: p.resolutionStatus,
      slaDeadlineAt: p.slaDeadlineAt,
      slaBreachedAt: p.slaBreachedAt,
      previousPodId: p.previousPodId,
      previousPod: p.previousPod
        ? {
            id: p.previousPod.id,
            url: p.previousPod.file?.url ?? null,
            backUrl: p.previousPod.backFile?.url ?? null,
            status: p.previousPod.status,
            rejectionReason: p.previousPod.rejectionReason,
            rejectedBy: p.previousPod.rejectedBy?.name ?? null,
          }
        : null,
    })),
    importantEvents: i.importantEvents.map((e) => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      title: e.title,
      description: e.description,
      status: e.status,
      dueAt: e.dueAt,
      createdAt: e.createdAt,
    })),
    lastTracking: lastPing
      ? {
          lat: lastPing.lat,
          lng: lastPing.lng,
          source: lastPing.source,
          accuracyMeters: lastPing.accuracyMeters,
          provider: lastPing.provider,
          recordedAt: lastPing.recordedAt,
        }
      : null,
    trip: tripRow
      ? { id: tripRow.id, lrNumber: tripRow.lrNumber, status: tripRow.status }
      : (i.lines[0]?.trip ?? null),
    lines: i.lines,
    documents: [] as { id: string; type: string; url: string; name: string | null; createdAt: string }[],
  };
}

export function mapIndentListItem(i: IndentWithRelations) {
  const flat = mapIndentToFlat(i);
  return {
    id: flat.id,
    indentNumber: flat.indentNumber,
    client: flat.client.name,
    route: `${flat.consignorCity || "—"} → ${flat.consigneeCity || "—"}`,
    vehicleType: flat.vehicleType,
    quantity: flat.quantity,
    material: flat.materialDescription,
    pickupDate: flat.pickupDate,
    clientRate: flat.clientRate,
    vendor: flat.vendor?.name ?? flat.bestQuoteVendor ?? null,
    vendorRate: flat.vendorRate || flat.bestQuoteRate || null,
    vehicle: flat.vehicle?.registrationNumber ?? null,
    status: flat.status,
    advanceStatus: flat.advanceStatus,
    placementStatus: flat.placementStatus,
  };
}
