import { requireAuth, authorize, ok, created, badRequest, unauthorized, serverError, safeOk } from "@/lib/api";
import { indentOperationalDateFieldErrors } from "@/lib/date-input";
import { indentSaveSchema, validate } from "@/lib/validation";
import { listIndents, createIndent } from "@/lib/services/indent.service";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.view");
  if (denied) return denied;
  return safeOk("indents.list", () => listIndents(), []);
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.create");
  if (denied) return denied;
  try {
    const body = await req.json();
    const pastDateErrors = indentOperationalDateFieldErrors(body as Record<string, unknown>);
    if (Object.keys(pastDateErrors).length > 0) {
      return badRequest("Validation failed", { fieldErrors: pastDateErrors });
    }
    const parsed = validate(indentSaveSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const indent = await createIndent(parsed.data, auth!.user.id);
    if (!indent) return serverError(new Error("Failed to create indent"));
    return created(indent);
  } catch (e) {
    return serverError(e);
  }
}
