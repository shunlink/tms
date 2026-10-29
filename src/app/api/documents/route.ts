import {
  requireAuth,
  authorize,
  ok,
  created,
  badRequest,
  unauthorized,
  notFound,
  serverError,
  isInternalRole,
  forbidden,
} from "@/lib/api";
import {
  listDocuments,
  uploadDocument,
  ownerExists,
  ALLOWED_DOCUMENT_TYPES,
  type DocumentEntityType,
} from "@/lib/services/document.service";
import { validateUploadedFile } from "@/lib/document-validation";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "trip.view");
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const ownerType = url.searchParams.get("ownerType") ?? "";
    const ownerId = url.searchParams.get("ownerId") ?? "";
    const entityType = ownerType.toUpperCase() as DocumentEntityType;
    if (!ownerId) return badRequest("ownerType and ownerId are required");

    const documents = await listDocuments(entityType, ownerId);
    return ok(documents);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!isInternalRole(auth.user.role)) return forbidden();
  try {
    const formData = await req.formData();
    const ownerType = String(formData.get("ownerType") || "");
    const ownerId = String(formData.get("ownerId") || "");
    const rawType = String(formData.get("type") || "OTHER");
    const file = formData.get("file");

    if (!ownerType || !ownerId) return badRequest("ownerType and ownerId are required");
    if (!(await ownerExists(ownerType, ownerId))) return notFound("Owner not found");
    if (!(file instanceof File)) return badRequest("No file uploaded");
    const fileCheck = validateUploadedFile({ name: file.name, size: file.size, type: file.type });
    if (!fileCheck.ok) {
      return badRequest(fileCheck.message, { code: "FILE_INVALID" });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const doc = await uploadDocument({
      ownerType,
      ownerId,
      documentType: ALLOWED_DOCUMENT_TYPES.includes(rawType) ? rawType : "OTHER",
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      buffer: bytes,
      uploadedById: auth.user.id,
    });
    return created(doc);
  } catch (e) {
    return serverError(e);
  }
}
