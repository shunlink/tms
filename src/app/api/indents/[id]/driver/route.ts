import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { indentDriverSchema, validate } from "@/lib/validation";
import { registerDriverForIndent } from "@/lib/services/driver.service";
import { isResourceAssignmentConflictMessage } from "@/lib/resource-assignment-eligibility";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.create");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(indentDriverSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const result = await registerDriverForIndent(params.id, parsed.data, auth!.user);
    if (!result) return notFound("Indent not found");
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Driver assignment failed";
    if (
      msg.includes("Vendor must be allocated") ||
      msg.includes("Vehicle and driver can only be assigned") ||
      isResourceAssignmentConflictMessage(msg)
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
