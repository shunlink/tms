import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, forbidden, notFound, serverError, badRequest } from "@/lib/api";
import { notifyClientOfTripStatus } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { listDocuments } from "@/lib/services/document.service";
import { invalidateDashboardCache } from "@/lib/invalidate-dashboard-cache";
import { canManuallyTransitionTrip, DRIVER_TRIP_STATUSES } from "@/lib/trip-states";
import { cancelOpenAdvanceRequestsForTrips, syncIndentFromTrip } from "@/lib/vendor-trip-sync";
import { ensureTripRouteGeocoded } from "@/lib/services/trip-route.service";

const now = () => new Date();

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: params.id },
      include: {
        client: true,
        vendor: true,
        vehicle: { include: { compliance: true } },
        driver: true,
        vendorPayments: true,
        indent: true,
      },
    });
    if (!trip) return notFound("Trip not found");

    if (auth!.user.role === "DRIVER") {
      if (trip.driverId !== auth!.user.driverId) return forbidden("This trip is not assigned to you");
    } else if (auth!.user.role === "VENDOR") {
      if (trip.vendorId !== auth!.user.vendorId) return forbidden("This trip is not assigned to your vendor account");
    } else {
      const denied = await authorize(auth, "trip.view");
      if (denied) return denied;
    }

    const documents = await listDocuments("TRIP", params.id);
    return ok({ ...trip, documents });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const user = auth!.user;
  try {
    const body = await req.json();
    const existing = await prisma.trip.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Trip not found");

    if (user.role === "DRIVER") {
      if (existing.driverId !== user.driverId) return forbidden("This trip is not assigned to you");
    } else {
      const denied = await authorize(auth, "trip.edit");
      if (denied) return denied;
    }

    if (body.status && body.status !== existing.status) {
      if (body.status === "POD_RECEIVED" || body.status === "CLOSED") {
        return forbidden(
          body.status === "CLOSED"
            ? "Trip closes automatically when POD is verified"
            : "POD received status is set when POD is verified — use the POD verification workflow"
        );
      }
      if (!canManuallyTransitionTrip(existing.status, body.status)) {
        return badRequest(`Invalid trip status change: ${existing.status} → ${body.status}`);
      }
    }

    if (user.role === "DRIVER") {
      if (!body.status || !DRIVER_TRIP_STATUSES.includes(body.status)) {
        return forbidden("Drivers can only update trip status");
      }
      if (body.status === existing.status) return ok(existing);
      const data: Record<string, unknown> = { status: body.status };
      if (body.status === "DISPATCHED" && !existing.dispatchedAt) data.dispatchedAt = now();
      if (body.status === "DELIVERED" && !existing.deliveredAt) data.deliveredAt = now();
      const trip = await prisma.trip.update({ where: { id: params.id }, data });
      if (body.status === "DISPATCHED" || body.status === "IN_TRANSIT") {
        await ensureTripRouteGeocoded(params.id);
      }
      await syncIndentFromTrip(params.id);
      await invalidateDashboardCache();
      await notifyClientOfTripStatus(params.id, body.status);
      await logAudit({
        user,
        action: AUDIT_ACTIONS.TRIP_UPDATED,
        entity: "Trip",
        entityId: params.id,
        tripId: params.id,
        meta: { by: "driver" },
        before: { status: existing.status },
        after: { status: body.status },
      });
      return ok(trip);
    }

    if (body.status === "CANCELLED" && existing.status !== "CANCELLED" && existing.indentId) {
      // The indent owns the lifecycle; cancelling it cascades to the trip, advances and alerts.
      const { cancelIndent } = await import("@/lib/services/indent.service");
      try {
        await cancelIndent(existing.indentId, user);
      } catch (e) {
        return badRequest(e instanceof Error ? e.message : "Trip cannot be cancelled");
      }
      const cancelled = await prisma.trip.findFirst({ where: { id: params.id } });
      await notifyClientOfTripStatus(params.id, "CANCELLED");
      await logAudit({
        user,
        action: AUDIT_ACTIONS.TRIP_UPDATED,
        entity: "Trip",
        entityId: params.id,
        tripId: params.id,
        meta: { fields: ["status"], via: "indent.cancel" },
        before: { status: existing.status },
        after: { status: "CANCELLED" },
      });
      return ok(cancelled);
    }

    const data: Record<string, unknown> = {};
    if (body.status && body.status !== existing.status) {
      data.status = body.status;
      if (body.status === "DISPATCHED" && !existing.dispatchedAt) data.dispatchedAt = now();
      if (body.status === "DELIVERED" && !existing.deliveredAt) data.deliveredAt = now();
    }
    for (const [field, key] of [
      ["routeFrom", "routeFrom"],
      ["routeTo", "routeTo"],
      ["cargoDetails", "cargoSummary"],
      ["remarks", "remarks"],
    ] as const) {
      if (body[field] !== undefined) data[key] = body[field];
    }
    if (body.clientRate != null) data.clientRate = Number(body.clientRate);
    if (body.vendorRate != null) data.vendorRate = Number(body.vendorRate);
    if (body.clientRate != null || body.vendorRate != null) {
      const cr = body.clientRate != null ? Number(body.clientRate) : existing.clientRate.toNumber();
      const vr = body.vendorRate != null ? Number(body.vendorRate) : existing.vendorRate.toNumber();
      data.margin = cr - vr;
    }
    if (body.expectedEndAt !== undefined) {
      data.expectedEndAt = body.expectedEndAt ? new Date(body.expectedEndAt) : null;
    }
    if (body.routeFrom !== undefined || body.routeTo !== undefined) {
      data.routeGeocodedAt = null;
      if (body.routeFrom !== undefined) {
        data.originLat = null;
        data.originLng = null;
      }
      if (body.routeTo !== undefined) {
        data.destLat = null;
        data.destLng = null;
      }
    }

    const trip = await prisma.trip.update({ where: { id: params.id }, data });
    if (
      data.status === "DISPATCHED" ||
      data.status === "IN_TRANSIT" ||
      body.routeFrom !== undefined ||
      body.routeTo !== undefined
    ) {
      await ensureTripRouteGeocoded(params.id);
    }
    const changedFields = Object.keys(data);
    if (changedFields.length > 0) {
      if (data.status && data.status !== existing.status) {
        if (data.status === "CANCELLED") {
          await cancelOpenAdvanceRequestsForTrips([params.id], "Trip cancelled");
        }
        await syncIndentFromTrip(params.id);
        await invalidateDashboardCache();
        await notifyClientOfTripStatus(params.id, String(data.status));
      }
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const key of changedFields) {
        const prev = (existing as Record<string, unknown>)[key];
        before[key] = prev != null && typeof prev === "object" && "toNumber" in prev
          ? (prev as { toNumber: () => number }).toNumber()
          : prev;
        after[key] = data[key];
      }
      await logAudit({
        user,
        action: AUDIT_ACTIONS.TRIP_UPDATED,
        entity: "Trip",
        entityId: params.id,
        tripId: params.id,
        meta: { fields: changedFields },
        before,
        after,
      });
    }
    return ok(trip);
  } catch (e) {
    return serverError(e);
  }
}
