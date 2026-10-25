import { requireAuth, authorize, ok, notFound, serverError, badRequest } from "@/lib/api";
import { placementSchema, validate } from "@/lib/validation";
import { markVehicleReached } from "@/lib/services/placement.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "placement.update");
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(placementSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    if (parsed.data.action === "vehicle_reached") {
      const indent = await markVehicleReached(params.id, auth!.user, parsed.data.indentLineId);
      if (!indent) return notFound("Indent not found");
      return ok(indent);
    }
    return badRequest("Unknown placement action");
  } catch (e) {
    return serverError(e);
  }
}
