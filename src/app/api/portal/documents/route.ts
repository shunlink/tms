import { requireAuth, ok, created, badRequest, forbidden, unauthorized, serverError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { listDocuments, uploadDocument, ALLOWED_DOCUMENT_TYPES, type DocumentEntityType } from "@/lib/services/document.service";
import { validateUploadedFile } from "@/lib/document-validation";
import { denyUnapprovedClientMutation } from "@/lib/client-portal-mutation-guard";
import { canSelfServiceEditPortalProfile } from "@/lib/portal-access";
import { getOnboardingStatus } from "@/lib/services/onboarding.service";

export const runtime = "nodejs";

type Owner = { type: DocumentEntityType; id: string };

function ownerOf(user: {
  role?: string;
  clientId?: string | null;
  vendorId?: string | null;
  driverId?: string | null;
}): Owner | null {
  if (user.role === "CLIENT" && user.clientId) return { type: "CLIENT", id: user.clientId };
  if (user.role === "VENDOR" && user.vendorId) return { type: "VENDOR", id: user.vendorId };
  if (user.role === "DRIVER" && user.driverId) return { type: "DRIVER", id: user.driverId };
  return null;
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const o = ownerOf(auth.user);
  if (!o) return forbidden("No onboarding record linked to this account");
  try {
    const documents = await listDocuments(o.type, o.id);
    return ok(documents);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const user = auth.user;
  const o = ownerOf(user);
  if (!o) return forbidden("No onboarding record linked to this account");
  if (o.type === "CLIENT") {
    const viewOnlyDenied = await denyUnapprovedClientMutation(auth);
    if (viewOnlyDenied) return viewOnlyDenied;
  }
  if (o.type === "CLIENT" || o.type === "VENDOR") {
    const status = await getOnboardingStatus(o.type, o.id);
    if (!canSelfServiceEditPortalProfile(status)) {
      return forbidden("Documents are read-only. Contact your administrator to make changes.");
    }
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const rawType = String(formData.get("type") || "OTHER");
    const type = ALLOWED_DOCUMENT_TYPES.includes(rawType) ? rawType : "OTHER";

    if (!(file instanceof File)) return badRequest("No file uploaded");
    const fileCheck = validateUploadedFile({ name: file.name, size: file.size, type: file.type });
    if (!fileCheck.ok) {
      return badRequest(fileCheck.message, { code: "FILE_INVALID" });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const doc = await uploadDocument({
      ownerType: o.type.toLowerCase(),
      ownerId: o.id,
      documentType: type,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      buffer: bytes,
      uploadedById: user.id,
    });
    await logAudit({ user, action: "portal.document.upload", entity: "DocumentAttachment", entityId: doc.id, meta: { ownerType: o.type, type } });
    return created(doc);
  } catch (e) {
    return serverError(e);
  }
}
