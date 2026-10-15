import { requireAuth, authorize, created, badRequest, notFound, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { putObject } from "@/lib/storage";
import { uploadPod } from "@/lib/services/pod.service";

export const runtime = "nodejs";
const MAX_SIZE = 10 * 1024 * 1024;

async function storePodFile(indentId: string, file: File, userId: string, label: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `pod/${indentId}/${label}-${Date.now()}-${safeName}`;
  const { url } = await putObject(key, bytes);
  return prisma.storedFile.create({
    data: {
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey: key,
      url,
      uploadedById: userId,
    },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "pod.upload");
  if (denied) return denied;
  try {
    const indent = await prisma.indent.findFirst({ where: { id: params.id }, select: { id: true } });
    if (!indent) return notFound("Indent not found");

    const formData = await req.formData();
    const front = formData.get("front") ?? formData.get("file");
    const back = formData.get("back");
    const rawSource = String(formData.get("source") || "");
    const source =
      rawSource === "VENDOR" ? "VENDOR" : rawSource === "EMPLOYEE" ? "EMPLOYEE" : "DRIVER";
    const remarks = String(formData.get("remarks") || "") || null;

    if (!(front instanceof File)) return badRequest("Front POD image is required");
    if (!(back instanceof File)) return badRequest("Back POD image is required");
    if (front.size === 0 || back.size === 0) return badRequest("POD files cannot be empty");
    if (front.size > MAX_SIZE || back.size > MAX_SIZE) return badRequest("File too large (max 10 MB)");

    const frontStored = await storePodFile(params.id, front, auth!.user.id, "front");
    const backStored = await storePodFile(params.id, back, auth!.user.id, "back");

    const result = await uploadPod(
      params.id,
      { frontFileId: frontStored.id, backFileId: backStored.id, source, remarks },
      auth!.user
    );
    if (!result) return notFound("Indent not found");
    return created(result);
  } catch (e) {
    return serverError(e);
  }
}
