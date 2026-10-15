import { requireAuth, authorize, created, badRequest, notFound, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { putObject } from "@/lib/storage";
import { correctBadPod } from "@/lib/services/pod.service";

export const runtime = "nodejs";
const MAX_SIZE = 10 * 1024 * 1024;

async function storeCorrectionFile(indentId: string, file: File, userId: string, label: string) {
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
  const denied = await authorize(auth, "pod.manage");
  if (denied) return denied;

  try {
    const badPod = await prisma.indentPod.findFirst({
      where: { id: params.id, status: "BAD_POD" },
      select: { id: true, indentId: true },
    });
    if (!badPod) return notFound("Bad POD not found");

    const formData = await req.formData();
    const front = formData.get("front") ?? formData.get("file");
    const back = formData.get("back");
    const remarks = String(formData.get("remarks") || "") || null;

    if (!(front instanceof File)) return badRequest("Front POD image is required");
    if (!(back instanceof File)) return badRequest("Back POD image is required");
    if (front.size === 0 || back.size === 0) return badRequest("POD files cannot be empty");
    if (front.size > MAX_SIZE || back.size > MAX_SIZE) return badRequest("File too large (max 10 MB)");

    const frontStored = await storeCorrectionFile(badPod.indentId, front, auth!.user.id, "front");
    const backStored = await storeCorrectionFile(badPod.indentId, back, auth!.user.id, "back");

    const result = await correctBadPod(
      params.id,
      { frontFileId: frontStored.id, backFileId: backStored.id, remarks },
      auth!.user
    );
    if (!result) return notFound("Could not correct POD");
    return created(result);
  } catch (e) {
    return serverError(e);
  }
}
