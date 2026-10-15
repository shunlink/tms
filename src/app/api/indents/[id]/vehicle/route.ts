import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { vehicleAssignmentSchema, validate } from "@/lib/validation";
import { assignVehicleToIndent } from "@/lib/services/vehicle.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vehicle.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(vehicleAssignmentSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const indent = await assignVehicleToIndent(params.id, parsed.data, auth!.user);
    if (!indent) return notFound("Indent not found");
    return ok(indent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Vehicle assignment failed";
    if (
      msg.includes("Vendor must be allocated") ||
      msg.includes("Vehicle and driver can only be assigned")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
