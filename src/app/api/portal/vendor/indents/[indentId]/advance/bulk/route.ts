import { requireAuth, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { validate, vendorBulkAdvanceBodySchema } from "@/lib/validation";
import {
  createBulkShunLinkAdvanceRequests,
  listIndentAdvanceEligibleTrips,
  splitBulkAdvanceAmounts,
} from "@/lib/services/trip-advance.service";

export async function POST(req: Request, { params }: { params: { indentId: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!auth.user.vendorId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = validate(vendorBulkAdvanceBodySchema, body);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    let items = parsed.data.items;

    if (!items?.length) {
      const split = parsed.data.split ?? "equal";
      const eligible = await listIndentAdvanceEligibleTrips(auth.user.vendorId, params.indentId);
      if (eligible.trips.length < 2) {
        return badRequest("Bulk advance requires at least two eligible trips on this indent");
      }
      if (split === "max") {
        items = splitBulkAdvanceAmounts(eligible.trips, "max");
      } else {
        const total = parsed.data.totalAmount;
        if (total == null) return badRequest("totalAmount is required when using equal split");
        items = splitBulkAdvanceAmounts(eligible.trips, "equal", total);
      }
    }

    const result = await createBulkShunLinkAdvanceRequests(
      auth.user.vendorId,
      params.indentId,
      items,
      parsed.data.remarks,
      auth.user
    );
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bulk advance request failed";
    if (
      msg.includes("not found") ||
      msg.includes("not allocated") ||
      msg.includes("already exists") ||
      msg.includes("cannot be requested") ||
      msg.includes("must be") ||
      msg.includes("exceeds") ||
      msg.includes("Duplicate") ||
      msg.includes("At least one")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
