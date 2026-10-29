import {
  requireAuth,
  authorize,
  ok,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  isInternalRole,
} from "@/lib/api";
import { deleteDocument } from "@/lib/services/document.service";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!isInternalRole(auth.user.role)) return forbidden();
  const denied = await authorize(auth, "pod.manage");
  if (denied) return denied;
  try {
    const deleted = await deleteDocument(params.id);
    if (!deleted) return notFound("Document not found");
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
