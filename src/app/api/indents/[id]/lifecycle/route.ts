import { requireAuth, authorize, ok, notFound, serverError, badRequest, unauthorized } from "@/lib/api";
import { releaseIndentToVendors, submitForAdvance, cancelIndent, transitionIndent, completeIndent } from "@/lib/services/indent.service";
import { indentReleaseSchema, validate } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    if (action === "submit_for_advance") {
      const denied = await authorize(auth, "indent.edit");
      if (denied) return denied;
      const indent = await submitForAdvance(params.id, auth.user);
      if (!indent) return notFound("Indent not found");
      return ok(indent);
    }
    if (action === "release") {
      const denied = await authorize(auth, "indent.release");
      if (denied) return denied;
      const parsed = validate(indentReleaseSchema, body);
      if (!parsed.success) return badRequest(parsed.error);
      const indent = await releaseIndentToVendors(params.id, parsed.data.cities, auth.user);
      if (!indent) return notFound("Indent not found");
      return ok(indent);
    }
    if (action === "cancel") {
      const denied = await authorize(auth, "indent.cancel");
      if (denied) return denied;
      const indent = await cancelIndent(params.id, auth.user);
      if (!indent) return notFound("Indent not found");
      return ok(indent);
    }
    if (action === "transition") {
      const denied = await authorize(auth, "indent.edit");
      if (denied) return denied;
      const to = String(body.status ?? "");
      const indent = await transitionIndent(params.id, to, auth.user);
      if (!indent) return notFound("Indent not found");
      return ok(indent);
    }
    if (action === "complete") {
      const denied = await authorize(auth, "indent.edit");
      if (denied) return denied;
      const indent = await completeIndent(params.id, auth.user);
      if (!indent) return notFound("Indent not found");
      return ok(indent);
    }
    return badRequest("Unknown action");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Action failed";
    if (
      msg.includes("Invalid state transition") ||
      msg.includes("Select at least") ||
      msg.includes("vendor cit") ||
      msg.includes("cannot be released") ||
      msg.includes("advance") ||
      msg.includes("Advance") ||
      msg.includes("Create trip before starting transit")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
