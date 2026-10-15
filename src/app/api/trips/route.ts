import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/sequence";
import { requireAuth, authorize, ok, created, badRequest, serverError, safeOk } from "@/lib/api";
import { tripSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { invalidateDashboardCache } from "@/lib/invalidate-dashboard-cache";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "trip.view");
  if (denied) return denied;
  return safeOk(
    "trips.list",
    () =>
      prisma.trip.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { name: true } },
          vendor: { select: { name: true, type: true } },
          vehicle: { select: { registrationNumber: true, vehicleTypeCode: true } },
          driver: { select: { name: true, phone: true } },
        },
      }),
    []
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "trip.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(tripSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const margin = d.clientRate - d.vendorRate;
    const lrNumber = await nextNumber("LR");

    const trip = await prisma.trip.create({
      data: {
        lrNumber,
        clientId: d.clientId,
        vendorId: d.vendorId,
        vehicleId: d.vehicleId,
        driverId: d.driverId,
        routeFrom: d.routeFrom,
        routeTo: d.routeTo,
        cargoSummary: d.cargoDetails,
        loadingWeight: d.loadingWeight,
        clientRate: d.clientRate,
        vendorRate: d.vendorRate,
        margin,
        status: d.status ?? "PENDING",
        driverArrivedAt: d.driverId ? new Date() : null,
      },
    });

    await invalidateDashboardCache();
    const { AUDIT_ACTIONS } = await import("@/lib/audit-actions");
    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.TRIP_CREATED,
      entity: "Trip",
      entityId: trip.id,
      tripId: trip.id,
      meta: { lrNumber, clientRate: d.clientRate, vendorRate: d.vendorRate, margin },
      after: { status: trip.status, lrNumber },
    });
    return created(trip);
  } catch (e) {
    return serverError(e);
  }
}
