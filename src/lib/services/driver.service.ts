import { prisma } from "../prisma";
import { assertTransition } from "../indent-states";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";
import { normalizeDl } from "../otp";
import { assertVehicleDriverAssignableForLine } from "../indent-placement";
import { assertDriverAvailableForIndentLine } from "../resource-assignment-eligibility";
import { resolveTargetLine, syncIndentHeaderFromLines } from "../indent-line-rollup";
import {
  issueDriverOtp,
  requestDriverLoginOtp,
  verifyDriverOtpSecure,
} from "./otp.service";

export { normalizeDl };

export type IndentDriverInput = {
  name: string;
  dlNumber: string;
  phone: string;
  deviceType: "SMARTPHONE" | "FEATURE_PHONE";
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  indentLineId?: string | null;
};

/** Look up a driver by DL (canonical identity). */
export async function lookupDriverByDl(dlNumber: string) {
  const dl = normalizeDl(dlNumber);
  const driver = await prisma.driver.findUnique({
    where: { dlNumber: dl },
    select: {
      id: true,
      name: true,
      phone: true,
      dlNumber: true,
      deviceType: true,
      otpVerified: true,
    },
  });
  return driver;
}

/**
 * Validate driver details and send OTP. Does not link the driver to the indent
 * until OTP is verified — DRIVER_ASSIGNED is only set after verification.
 */
export async function registerDriverForIndent(
  indentId: string,
  input: IndentDriverInput,
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;
  const line = await resolveTargetLine(indentId, input.indentLineId);
  assertVehicleDriverAssignableForLine(indent, line);

  const dlNumber = normalizeDl(input.dlNumber);
  const existing = await prisma.driver.findUnique({ where: { dlNumber } });

  const driver = await prisma.$transaction(async (tx) => {
    let d = existing;
    if (!d) {
      d = await tx.driver.create({
        data: {
          name: input.name,
          phone: input.phone,
          dlNumber,
          deviceType: input.deviceType,
          address: input.address ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          pincode: input.pincode ?? null,
          accountStatus: "ACTIVE",
          kycStatus: "PENDING",
        },
      });
      const crypto = await import("crypto");
      await tx.user.create({
        data: {
          name: input.name,
          password: crypto.randomUUID(),
          role: "DRIVER",
          driverId: d.id,
        },
      });
    } else {
      d = await tx.driver.update({
        where: { id: d.id },
        data: {
          name: input.name,
          phone: input.phone,
          deviceType: input.deviceType,
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.state !== undefined ? { state: input.state } : {}),
          ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
        },
      });
      await tx.user.updateMany({
        where: { driverId: d.id },
        data: { name: input.name },
      });
    }
    return d;
  });

  await assertDriverAvailableForIndentLine(driver.id, line.id, line.tripId);

  const { createImportantEvent, resolveImportantEvents } = await import("./important-event.service");
  // A new OTP request supersedes earlier pending verifications on this indent.
  await resolveImportantEvents(
    { types: ["DRIVER_OTP_PENDING"], indentId },
    { actorId: actor?.id, status: "DISMISSED" }
  );
  await createImportantEvent({
    type: "DRIVER_OTP_PENDING",
    severity: "WARNING",
    title: `Driver OTP verification pending for ${indent.indentNumber} (vehicle ${line.lineNumber})`,
    description: `${input.name} (${dlNumber})`,
    indentId,
    relatedEntityId: driver.id,
  });

  await logAudit({
    user: actor,
    action: "indent.driver_otp_requested",
    entity: "INDENT",
    entityId: indentId,
    meta: {
      driverId: driver.id,
      dlNumber,
      existing: Boolean(existing),
      indentLineId: line.id,
      lineNumber: line.lineNumber,
    },
  });

  await sendDriverOtp(driver.id);

  return {
    driver: {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      dlNumber: driver.dlNumber,
      deviceType: driver.deviceType,
      existing: Boolean(existing),
      otpVerified: driver.otpVerified,
    },
    otpSent: true,
  };
}

/** Verify OTP and link the driver to the indent (DRIVER_ASSIGNED). */
export async function verifyDriverForIndent(
  indentId: string,
  driverId: string,
  otp: string,
  actor?: SessionUser | null,
  indentLineId?: string | null
) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;
  const line = await resolveTargetLine(indentId, indentLineId);
  assertVehicleDriverAssignableForLine(indent, line);

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new Error("Driver not found");

  await assertDriverAvailableForIndentLine(driverId, line.id, line.tripId);

  await verifyDriverOtpSecure({ driverId, otp, purpose: "driver_verify" });

  await prisma.$transaction(async (tx) => {
    const nextStatus = indent.status === "VEHICLE_PLACED" ? "DRIVER_ASSIGNED" : indent.status;
    if (indent.status === "VEHICLE_PLACED") {
      assertTransition(indent.status, "DRIVER_ASSIGNED");
    }

    const alloc = await tx.indentAllocation.findFirst({
      where: { indentLineId: line.id, status: "ACTIVE" },
      orderBy: { allocatedAt: "desc" },
    });
    if (alloc) {
      await tx.indentAllocation.update({
        where: { id: alloc.id },
        data: { driverId },
      });
    }

    await tx.indent.update({
      where: { id: indentId },
      data: {
        ...(indent.status === "VEHICLE_PLACED" ? { status: nextStatus } : {}),
      },
    });
    await syncIndentHeaderFromLines(indentId, tx);
  });

  const { resolveImportantEvents } = await import("./important-event.service");
  await resolveImportantEvents({ types: ["DRIVER_OTP_PENDING"], indentId }, { actorId: actor?.id });

  await logAudit({
    user: actor,
    action: "indent.driver_assigned",
    entity: "INDENT",
    entityId: indentId,
    meta: { driverId, dlNumber: driver.dlNumber },
  });

  const { autoMockVerifyDriverOnAssign } = await import("../integrations/auto-mock-verify");
  await autoMockVerifyDriverOnAssign(driverId, actor);

  return (await import("./indent.service")).getIndentById(indentId);
}

/** Send OTP to a driver's registered phone (ops / indent verification). */
export async function sendDriverOtp(driverId: string, ip?: string | null) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new Error("Driver not found");
  if (!driver.phone) throw new Error("Driver has no registered phone");

  return issueDriverOtp({
    driverId,
    phone: driver.phone,
    purpose: "driver_verify",
    deviceType: driver.deviceType as "SMARTPHONE" | "FEATURE_PHONE",
    ip,
  });
}

/**
 * Public OTP request for driver login. Identity = DL number; the driver must
 * also know the registered phone.
 */
export async function requestDriverOtp(dlNumber: string, phone: string, ip?: string | null) {
  return requestDriverLoginOtp(dlNumber, phone, ip);
}

export async function verifyDriverOtp(driverId: string, otp: string) {
  return verifyDriverOtpSecure({ driverId, otp, purpose: "driver_verify" });
}

const DRIVER_ACTIVE_TRIP_EXCLUDE = ["CLOSED", "INVOICED", "CANCELLED"] as const;

function mapPings(
  pings: Array<{ id: string; lat: number; lng: number; note: string | null; recordedAt: Date }>
) {
  return pings.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    note: p.note,
    createdAt: p.recordedAt.toISOString(),
  }));
}

/** Current active assignment for a driver — trip-scoped (multi-vehicle / multi-driver). */
export async function getDriverCurrentIndent(driverId: string) {
  const trip = await prisma.trip.findFirst({
    where: {
      driverId,
      status: { notIn: [...DRIVER_ACTIVE_TRIP_EXCLUDE] },
      indentId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      vehicle: { select: { registrationNumber: true } },
      pings: {
        where: { driverId },
        orderBy: { recordedAt: "desc" },
        take: 5,
        select: { id: true, lat: true, lng: true, note: true, recordedAt: true },
      },
      pods: { select: { status: true, resolutionStatus: true } },
      indent: {
        include: {
          client: { select: { name: true } },
          consignment: { select: { cargoTypeCode: true, pickupAt: true, deliveryAt: true } },
          loading: { select: { city: true, state: true } },
          unloading: { select: { city: true, state: true } },
        },
      },
    },
  });

  if (trip?.indent) {
    const indent = trip.indent;
    const { deriveTripPodQueueState } = await import("../pod-upload-eligibility");
    const podState = deriveTripPodQueueState(trip.pods ?? []);
    return {
      id: indent.id,
      indentNumber: indent.indentNumber,
      lrNumber: trip.lrNumber,
      client: indent.client.name,
      pickup: `${indent.loading?.city ?? "—"}, ${indent.loading?.state ?? ""}`.trim(),
      delivery: `${indent.unloading?.city ?? "—"}, ${indent.unloading?.state ?? ""}`.trim(),
      pickupAt: indent.consignment?.pickupAt?.toISOString() ?? null,
      deliveryAt: indent.consignment?.deliveryAt?.toISOString() ?? null,
      vehicle: trip.vehicle.registrationNumber,
      cargo: indent.consignment?.cargoTypeCode ?? null,
      status: indent.status,
      tripId: trip.id,
      tripStatus: trip.status,
      podState,
      podReceivedAt: trip.podReceivedAt,
      pings: mapPings(trip.pings),
    };
  }

  // Legacy: single-vehicle indent with driver on header only
  const indent = await prisma.indent.findFirst({
    where: {
      driverId,
      status: { notIn: ["CANCELLED", "COMPLETED", "POD_RECEIVED", "POD_PENDING", "DELIVERED"] },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { name: true } },
      vehicle: { select: { registrationNumber: true } },
      consignment: { select: { cargoTypeCode: true, pickupAt: true, deliveryAt: true } },
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      trips: {
        where: { driverId },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          lrNumber: true,
          status: true,
          podReceivedAt: true,
          pings: {
            where: { driverId },
            orderBy: { recordedAt: "desc" },
            take: 5,
            select: { id: true, lat: true, lng: true, note: true, recordedAt: true },
          },
        },
      },
    },
  });

  if (!indent) return null;
  const legacyTrip = indent.trips[0] ?? null;

  return {
    id: indent.id,
    indentNumber: indent.indentNumber,
    lrNumber: legacyTrip?.lrNumber ?? indent.indentNumber,
    client: indent.client.name,
    pickup: `${indent.loading?.city ?? "—"}, ${indent.loading?.state ?? ""}`.trim(),
    delivery: `${indent.unloading?.city ?? "—"}, ${indent.unloading?.state ?? ""}`.trim(),
    pickupAt: indent.consignment?.pickupAt?.toISOString() ?? null,
    deliveryAt: indent.consignment?.deliveryAt?.toISOString() ?? null,
    vehicle: indent.vehicle?.registrationNumber ?? null,
    cargo: indent.consignment?.cargoTypeCode ?? null,
    status: indent.status,
    tripId: legacyTrip?.id ?? null,
    tripStatus: legacyTrip?.status ?? null,
    podReceivedAt: legacyTrip?.podReceivedAt ?? null,
    pings: legacyTrip ? mapPings(legacyTrip.pings) : [],
  };
}

/** Driver mobile app — profile fields (no internal onboarding docs). */
export async function getDriverMeProfile(driverId: string) {
  const d = await prisma.driver.findFirst({ where: { id: driverId } });
  if (!d) return null;
  const onboardingComplete = Boolean(
    d.name?.trim() &&
      d.phone?.trim() &&
      d.dlNumber?.trim() &&
      d.dlExpiry &&
      d.dlExpiry.getTime() >= Date.now() &&
      d.address?.trim() &&
      d.city?.trim() &&
      d.state?.trim() &&
      d.pincode?.trim()
  );

  return {
    id: d.id,
    name: d.name,
    phone: d.phone,
    dlNumber: d.dlNumber,
    dlExpiry: d.dlExpiry?.toISOString() ?? null,
    address: d.address ?? null,
    city: d.city ?? null,
    state: d.state ?? null,
    pincode: d.pincode ?? null,
    deviceType: d.deviceType,
    otpVerified: d.otpVerified,
    accountStatus: d.accountStatus,
    kycStatus: d.kycStatus,
    onboardingComplete,
  };
}

const DRIVER_TRIP_ACCESS_OR = (driverId: string) =>
  [
    { driverId },
    { indent: { is: { driverId } } },
    { indentLine: { is: { allocations: { some: { driverId, status: "ACTIVE" } } } } },
    { indent: { is: { allocations: { some: { driverId, status: "ACTIVE" } } } } },
    { pings: { some: { driverId } } },
  ] as const;

const driverTripPodSelect = {
  id: true,
  status: true,
  indentId: true,
  driverId: true,
} as const;

/**
 * Resolve a trip the driver may access for mobile POD / trip detail.
 * Accepts trip id or indent id (some flows still deep-link with indent id).
 */
export async function resolveDriverAccessibleTrip(driverId: string, tripOrIndentId: string) {
  const key = tripOrIndentId.trim();
  if (!key) return null;

  const directOwned = await prisma.trip.findFirst({
    where: { id: key, driverId },
    select: driverTripPodSelect,
  });
  if (directOwned) return directOwned;

  const accessOr = DRIVER_TRIP_ACCESS_OR(driverId);

  const byTripId = await prisma.trip.findFirst({
    where: { AND: [{ id: key }, { OR: [...accessOr] }] },
    select: driverTripPodSelect,
  });
  if (byTripId) return byTripId;

  return prisma.trip.findFirst({
    where: { AND: [{ indentId: key }, { OR: [...accessOr] }] },
    orderBy: { updatedAt: "desc" },
    select: driverTripPodSelect,
  });
}

/** Driver id from DB for the signed-in user (prefer over JWT session fields). */
export async function getDriverIdForAuthUser(user: { id?: string; role?: string }) {
  if (user.role !== "DRIVER" || !user.id) return null;
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { driverId: true },
  });
  return row?.driverId ?? null;
}

/** When header driverId was never set, align trip with the authenticated driver. */
export async function ensureTripDriverId(tripId: string, driverId: string) {
  await prisma.trip.updateMany({
    where: { id: tripId, driverId: null },
    data: { driverId },
  });
}

/** Single trip overview for driver mobile (must belong to driver). */
export async function getDriverMeTripDetail(driverId: string, tripId: string) {
  const resolved = await resolveDriverAccessibleTrip(driverId, tripId);
  if (!resolved) return null;

  const trip = await prisma.trip.findFirst({
    where: { id: resolved.id },
    select: {
      id: true,
      lrNumber: true,
      routeFrom: true,
      routeTo: true,
      status: true,
      dispatchedAt: true,
      deliveredAt: true,
      podReceivedAt: true,
      vehicle: { select: { registrationNumber: true } },
      pods: { select: { status: true, resolutionStatus: true } },
      indent: {
        select: {
          indentNumber: true,
          status: true,
          client: { select: { name: true } },
          consignment: { select: { cargoTypeCode: true, pickupAt: true, deliveryAt: true } },
          loading: { select: { city: true, state: true } },
          unloading: { select: { city: true, state: true } },
        },
      },
    },
  });
  if (!trip) return null;

  await ensureTripDriverId(trip.id, driverId);

  const { deriveTripPodQueueState } = await import("../pod-upload-eligibility");
  const indent = trip.indent;
  const pickup =
    indent?.loading?.city != null
      ? `${indent.loading.city ?? "—"}, ${indent.loading.state ?? ""}`.trim()
      : trip.routeFrom;
  const delivery =
    indent?.unloading?.city != null
      ? `${indent.unloading.city ?? "—"}, ${indent.unloading.state ?? ""}`.trim()
      : trip.routeTo;

  return {
    tripId: trip.id,
    lrNumber: trip.lrNumber,
    indentNumber: indent?.indentNumber ?? null,
    client: indent?.client?.name ?? "—",
    pickup,
    delivery,
    pickupAt: indent?.consignment?.pickupAt?.toISOString() ?? null,
    deliveryAt: indent?.consignment?.deliveryAt?.toISOString() ?? null,
    vehicle: trip.vehicle?.registrationNumber ?? null,
    cargo: indent?.consignment?.cargoTypeCode ?? null,
    assignmentStatus: indent?.status ?? null,
    tripStatus: trip.status,
    podState: deriveTripPodQueueState(trip.pods ?? []),
    dispatchedAt: trip.dispatchedAt?.toISOString() ?? null,
    deliveredAt: trip.deliveredAt?.toISOString() ?? null,
  };
}

/** Paginated trip history for the authenticated driver (mobile). */
export async function listDriverTripHistoryForMobile(driverId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const where = { driverId };

  const [total, trips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        lrNumber: true,
        routeFrom: true,
        routeTo: true,
        status: true,
        createdAt: true,
        dispatchedAt: true,
        deliveredAt: true,
        podReceivedAt: true,
        tripClosedAt: true,
        vehicle: { select: { registrationNumber: true } },
        indent: { select: { indentNumber: true } },
        pods: { select: { status: true, resolutionStatus: true } },
      },
    }),
  ]);

  const { deriveTripPodQueueState } = await import("../pod-upload-eligibility");

  return {
    items: trips.map((t) => ({
      tripId: t.id,
      indentNumber: t.indent?.indentNumber ?? "—",
      lrNumber: t.lrNumber,
      pickup: t.routeFrom,
      delivery: t.routeTo,
      tripDate: (t.dispatchedAt ?? t.createdAt).toISOString(),
      tripEndDate: (t.deliveredAt ?? t.podReceivedAt ?? t.tripClosedAt)?.toISOString() ?? null,
      vehicleRegistration: t.vehicle?.registrationNumber ?? "—",
      tripStatus: t.status,
      podState: deriveTripPodQueueState(t.pods ?? []),
    })),
    page,
    total,
  };
}

export type DriverMobileSignupInput = {
  name: string;
  dlNumber: string;
  phone: string;
};

/** Self-service registration from the driver mobile app (no session required). */
export async function registerDriverMobileSignup(input: DriverMobileSignupInput) {
  const { AppError } = await import("../api-errors");
  const dlNumber = normalizeDl(input.dlNumber);
  const name = input.name.trim();
  const phone = input.phone;

  const existing = await prisma.driver.findUnique({ where: { dlNumber } });
  if (existing) {
    throw new AppError("A driver is already registered with this DL number. Please log in instead.", {
      status: 409,
      code: "CONFLICT",
    });
  }

  const crypto = await import("crypto");
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);

  const driver = await prisma.$transaction(async (tx) => {
    const d = await tx.driver.create({
      data: {
        name,
        phone,
        dlNumber,
        deviceType: "SMARTPHONE",
        accountStatus: "ACTIVE",
        kycStatus: "PENDING",
      },
    });
    await tx.user.create({
      data: {
        name,
        password: passwordHash,
        role: "DRIVER",
        driverId: d.id,
      },
    });
    return d;
  });

  await logAudit({
    user: null,
    action: "driver.self_registered",
    entity: "DRIVER",
    entityId: driver.id,
    meta: { source: "mobile" },
  });

  return {
    id: driver.id,
    name: driver.name,
    dlNumber: driver.dlNumber,
    phone: driver.phone,
  };
}
