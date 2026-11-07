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
import { deleteDocument, getDocumentAttachment } from "@/lib/services/document.service";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!isInternalRole(auth.user.role)) return forbidden();
  try {
    const attachment = await getDocumentAttachment(params.id);
    if (!attachment) return notFound("Document not found");

    const permission =
      attachment.entityType === "INDENT" ? "indent.edit" : "pod.manage";
    const denied = await authorize(auth, permission);
    if (denied) return denied;

    const deleted = await deleteDocument(params.id);
    if (!deleted) return notFound("Document not found");
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
