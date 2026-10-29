import { prisma } from "@/lib/prisma";
import { validateBiddingIntegrationRequest } from "@/lib/integration/bidding/auth";
import { biddingCompanyIdQuerySchema } from "@/lib/integration/bidding/schemas";
import {
  resolveBiddingVendorTripId,
  resolveVendorIdByBiddingCompany,
  resolveVendorPortalActorForBidding,
} from "@/lib/services/bidding-integration.service";
import {
  advanceWindowClosedReason,
  createShunLinkAdvanceRequest,
  getVendorTripAdvanceRequest,
  isTripAdvanceWindowOpen,
} from "@/lib/services/trip-advance.service";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { tripId: string } }) {
  const authError = validateBiddingIntegrationRequest(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const parsed = biddingCompanyIdQuerySchema.safeParse({
    biddingCompanyId: searchParams.get("biddingCompanyId"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const vendorId = await resolveVendorIdByBiddingCompany(parsed.data.biddingCompanyId);
  if (!vendorId) {
    return Response.json({ error: "Vendor not linked", code: "VENDOR_NOT_LINKED" }, { status: 404 });
  }

  const tripId = await resolveBiddingVendorTripId(vendorId, params.tripId.trim());
  if (!tripId) {
    return Response.json({ error: "Trip not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const request = await getVendorTripAdvanceRequest(vendorId, tripId);
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, vendorId },
    select: { status: true, vendorRate: true },
  });
  if (!trip) {
    return Response.json({ error: "Trip not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const windowOpen = await isTripAdvanceWindowOpen(tripId);
  const closedReason = advanceWindowClosedReason(trip.status);
  const hasLiveRequest = Boolean(
    request && !["REJECTED", "CANCELLED"].includes(request.status),
  );

  return Response.json({
    tripId,
    request,
    canRequestAdvance: windowOpen && !hasLiveRequest,
    advanceWindowOpen: windowOpen,
    advanceWindowClosedReason: closedReason,
    vendorRate: trip.vendorRate != null ? Number(trip.vendorRate) : null,
  });
}

export async function POST(req: Request, { params }: { params: { tripId: string } }) {
  const authError = validateBiddingIntegrationRequest(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const parsed = biddingCompanyIdQuerySchema.safeParse({
    biddingCompanyId: searchParams.get("biddingCompanyId"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const vendorId = await resolveVendorIdByBiddingCompany(parsed.data.biddingCompanyId);
  if (!vendorId) {
    return Response.json({ error: "Vendor not linked", code: "VENDOR_NOT_LINKED" }, { status: 404 });
  }

  const tripId = await resolveBiddingVendorTripId(vendorId, params.tripId.trim());
  if (!tripId) {
    return Response.json({ error: "Trip not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    amount?: number;
    requestedAmount?: number;
    remarks?: string;
    requestedByEmail?: string;
  };
  const requestedAmount = body.requestedAmount ?? body.amount;
  if (requestedAmount == null || !Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return Response.json(
      { error: "amount must be a positive number", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const actor = await resolveVendorPortalActorForBidding(vendorId, body.requestedByEmail);

  try {
    const result = await createShunLinkAdvanceRequest(
      tripId,
      vendorId,
      { requestedAmount, remarks: body.remarks },
      actor,
    );
    return Response.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Advance request failed";
    return Response.json({ error: msg, code: "INVALID_STATE" }, { status: 400 });
  }
}
