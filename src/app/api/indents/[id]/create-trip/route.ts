import { requireAuth, authorize, ok, notFound, serverError, badRequest } from "@/lib/api";
import { createTripFromIndent } from "@/lib/services/trip-from-indent.service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.edit");
  if (denied) return denied;
  try {
    const trip = await createTripFromIndent(params.id, auth!.user);
    if (!trip) return notFound("Indent not found");
    return ok(trip);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create trip";
    if (
      msg.includes("Trip can only be created") ||
      msg.includes("must be allocated") ||
      msg.includes("must be assigned")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
