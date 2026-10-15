import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { internalAdvanceRaiseSchema, validate } from "@/lib/validation";
import {
  createInternalAdvanceRequest,
  getAdvanceTripContext,
  listAdvanceRequests,
} from "@/lib/services/trip-advance.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "advance.view");
  if (denied) return denied;

  const url = new URL(req.url);
  const tripId = url.searchParams.get("tripId");
  const vendorId = url.searchParams.get("vendorId");
  if (tripId && vendorId) {
    const contextDenied = await authorize(auth, "advance.decide");
    if (contextDenied) return contextDenied;
    try {
      const context = await getAdvanceTripContext(tripId, vendorId);
      return ok({ context });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load trip context";
      if (msg.includes("not found") || msg.includes("not assigned") || msg.includes("cannot be")) {
        return badRequest(msg);
      }
      return serverError(e);
    }
  }

  const status = url.searchParams.get("status") ?? undefined;
  const vendorIdFilter = url.searchParams.get("vendorId") ?? undefined;
  const tripIdFilter = url.searchParams.get("tripId") ?? undefined;
  const slaBreachedOnly = url.searchParams.get("slaBreached") === "true";
  const source = url.searchParams.get("source") ?? "SHUNLINK";

  try {
    const requests = await listAdvanceRequests({
      source,
      status,
      vendorId: vendorIdFilter,
      tripId: tripIdFilter,
      slaBreachedOnly,
    });
    return ok({ requests });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.vendorId) return unauthorized();

  const denied = await authorize(auth, "advance.decide");
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const parsed = validate(internalAdvanceRaiseSchema, body);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const request = await createInternalAdvanceRequest(
      parsed.data.tripId,
      parsed.data.vendorId,
      {
        requestedAmount: parsed.data.amount,
        remarks: parsed.data.remarks,
      },
      auth.user
    );
    return ok(request);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to raise advance request";
    if (
      msg.includes("not found") ||
      msg.includes("not assigned") ||
      msg.includes("already exists") ||
      msg.includes("cannot be") ||
      msg.includes("must be") ||
      msg.includes("Unauthorized") ||
      msg.includes("cannot raise")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
