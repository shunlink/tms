import { requireAuth, authorize, ok, badRequest, unauthorized, notFound, serverError } from "@/lib/api";
import { indentSchema, validate } from "@/lib/validation";
import { getIndentById, updateIndent } from "@/lib/services/indent.service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.view");
  if (denied) return denied;
  try {
    const indent = await getIndentById(params.id);
    if (!indent) return notFound("Indent not found");
    return ok(indent);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(indentSchema.partial(), body);
    if (!parsed.success) return badRequest(parsed.error);

    const indent = await updateIndent(params.id, parsed.data);
    if (!indent) return notFound("Indent not found");
    return ok(indent);
  } catch (e) {
    return serverError(e);
  }
}
