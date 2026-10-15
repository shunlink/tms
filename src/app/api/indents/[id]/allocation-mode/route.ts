import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { allocationModeSchema, validate } from "@/lib/validation";
import { setAllocationMode } from "@/lib/services/allocation.service";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.allocate");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(allocationModeSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const indent = await setAllocationMode(params.id, parsed.data.mode, auth!.user);
    if (!indent) return notFound("Indent not found");
    return ok(indent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update allocation mode";
    if (msg.includes("Cannot change")) return badRequest(msg);
    return serverError(e);
  }
}
