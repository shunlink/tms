import { prisma } from "../prisma";
import { assertTransition } from "../indent-states";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";
import { normalizeDl } from "../otp";
import { assertVehicleDriverAssignable } from "../indent-placement";
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
  assertVehicleDriverAssignable(indent);

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
    }
    return d;
  });

  const { createImportantEvent, resolveImportantEvents } = await import("./important-event.service");
  // A new OTP request supersedes earlier pending verifications on this indent.
  await resolveImportantEvents(
    { types: ["DRIVER_OTP_PENDING"], indentId },
    { actorId: actor?.id, status: "DISMISSED" }
  );
  await createImportantEvent({
    type: "DRIVER_OTP_PENDING",
    severity: "WARNING",
    title: `Driver OTP verification pending for ${indent.indentNumber}`,
    description: `${input.name} (${dlNumber})`,
    indentId,
    relatedEntityId: driver.id,
  });

  await logAudit({
    user: actor,
    action: "indent.driver_otp_requested",
    entity: "INDENT",
    entityId: indentId,
    meta: { driverId: driver.id, dlNumber, existing: Boolean(existing) },
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
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;
  assertVehicleDriverAssignable(indent);

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new Error("Driver not found");

  await verifyDriverOtpSecure({ driverId, otp, purpose: "driver_verify" });

  await prisma.$transaction(async (tx) => {
    const nextStatus = indent.status === "VEHICLE_PLACED" ? "DRIVER_ASSIGNED" : indent.status;
    if (indent.status === "VEHICLE_PLACED") {
      assertTransition(indent.status, "DRIVER_ASSIGNED");
    }

    await tx.indent.update({
      where: { id: indentId },
      data: { driverId, ...(indent.status === "VEHICLE_PLACED" ? { status: nextStatus } : {}) },
    });

    const alloc = await tx.indentAllocation.findFirst({
      where: { indentId, status: "ACTIVE" },
      orderBy: { allocatedAt: "desc" },
    });
    if (alloc) {
      await tx.indentAllocation.update({
        where: { id: alloc.id },
        data: { driverId },
      });
    }
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

/** Current active indent for a driver (minimal, no historical exposure). */
export async function getDriverCurrentIndent(driverId: string) {
  const indent = await prisma.indent.findFirst({
    where: {
      driverId,
      status: { notIn: ["CANCELLED", "COMPLETED", "POD_RECEIVED", "POD_PENDING", "DELIVERED"] },
      trips: { none: { status: { in: ["DELIVERED", "CLOSED", "INVOICED", "CANCELLED"] } } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { name: true } },
      vehicle: { select: { registrationNumber: true } },
      consignment: { select: { cargoTypeCode: true, pickupAt: true, deliveryAt: true } },
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      trips: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
      trackingPings: { orderBy: { recordedAt: "desc" }, take: 5, select: { id: true, lat: true, lng: true, note: true, recordedAt: true } },
    },
  });

  if (!indent) return null;

  const trip = indent.trips[0] ?? null;

  return {
    id: indent.id,
    indentNumber: indent.indentNumber,
    client: indent.client.name,
    pickup: `${indent.loading?.city ?? "—"}, ${indent.loading?.state ?? ""}`.trim(),
    delivery: `${indent.unloading?.city ?? "—"}, ${indent.unloading?.state ?? ""}`.trim(),
    vehicle: indent.vehicle?.registrationNumber ?? null,
    cargo: indent.consignment?.cargoTypeCode ?? null,
    status: indent.status,
    tripId: trip?.id ?? null,
    tripStatus: trip?.status ?? null,
    pings: indent.trackingPings.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      note: p.note,
      createdAt: p.recordedAt.toISOString(),
    })),
  };
}
