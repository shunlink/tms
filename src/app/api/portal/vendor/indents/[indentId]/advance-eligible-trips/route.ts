import { requireAuth, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { listIndentAdvanceEligibleTrips } from "@/lib/services/trip-advance.service";

export async function GET(_req: Request, { params }: { params: { indentId: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!auth.user.vendorId) return unauthorized();

  try {
    const data = await listIndentAdvanceEligibleTrips(auth.user.vendorId, params.indentId);
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load eligible trips";
    if (msg.includes("not found") || msg.includes("not allocated")) return badRequest(msg);
    return serverError(e);
  }
}
