import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { importantEventActionSchema, validate } from "@/lib/validation";
import { actOnImportantEvent } from "@/lib/services/important-event.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "events.manage");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(importantEventActionSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const updated = await actOnImportantEvent(params.id, parsed.data.action, auth!.user);
    if (!updated) return notFound("Event not found");
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
