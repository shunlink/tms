import { requireAuth, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import { tripAdvanceRequestSchema, validate } from "@/lib/validation";
import {
  advanceWindowClosedReason,
  createShunLinkAdvanceRequest,
  getVendorTripAdvanceRequest,
  isTripAdvanceWindowOpen,
  recordExternalAdvanceIntent,
  vendorAcceptNegotiatedAdvance,
} from "@/lib/services/trip-advance.service";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!auth.user.vendorId) return unauthorized();

  try {
    const request = await getVendorTripAdvanceRequest(auth.user.vendorId, params.id);
    const trip = await prisma.trip.findFirst({
      where: { id: params.id, vendorId: auth.user.vendorId },
      select: { status: true },
    });
    const windowOpen = trip ? await isTripAdvanceWindowOpen(params.id) : false;
    const closedReason = trip ? advanceWindowClosedReason(trip.status) : null;
    const hasLiveRequest = Boolean(
      request && !["REJECTED", "CANCELLED"].includes(request.status)
    );
    return ok({
      request,
      canRequestAdvance: windowOpen && !hasLiveRequest,
      advanceWindowClosedReason: closedReason,
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!auth.user.vendorId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "create");

  try {
    if (action === "accept_negotiation") {
      const requestId = String(body.requestId ?? "");
      if (!requestId) return badRequest("requestId is required");
      const result = await vendorAcceptNegotiatedAdvance(requestId, auth.user.vendorId, auth.user);
      if (!result) return notFound("Advance request not found");
      return ok(result);
    }

    const parsed = validate(tripAdvanceRequestSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    if (parsed.data.source === "EXTERNAL") {
      const result = await recordExternalAdvanceIntent(
        params.id,
        auth.user.vendorId,
        {
          provider: parsed.data.externalProvider ?? "OTHER",
          remarks: parsed.data.remarks,
        },
        auth.user
      );
      return ok(result);
    }

    const result = await createShunLinkAdvanceRequest(
      params.id,
      auth.user.vendorId,
      {
        requestedAmount: parsed.data.requestedAmount!,
        remarks: parsed.data.remarks,
      },
      auth.user
    );
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Advance request failed";
    if (
      msg.includes("not found") ||
      msg.includes("already exists") ||
      msg.includes("cannot be requested") ||
      msg.includes("before the trip is marked delivered") ||
      msg.includes("must be")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
