import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { listDocuments, uploadDocument } from "@/lib/services/document.service";
import { uploadPodFromTrip } from "@/lib/services/pod.service";
import {
  canUploadTripPod,
  deriveTripPodQueueState,
  POD_ALREADY_SUBMITTED_MESSAGE,
  tripPodAlreadySubmitted,
} from "@/lib/pod-upload-eligibility";
import {
  requireAuth,
  authorize,
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  isInternalRole,
} from "@/lib/api";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["LR", "EWAY_BILL", "POD", "DELIVERY_CHALLAN", "GATE_PASS", "INVOICE", "OTHER"];
const MAX_SIZE = 10 * 1024 * 1024;

async function uploadTripFile(
  tripId: string,
  file: File,
  type: string,
  userId: string,
  suffix?: string
) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return uploadDocument({
    ownerType: "trip",
    ownerId: tripId,
    documentType: type,
    fileName: suffix ? `${suffix}-${file.name}` : file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    buffer: bytes,
    uploadedById: userId,
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const user = auth.user;
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: params.id },
      select: { id: true, vendorId: true, driverId: true },
    });
    if (!trip) return notFound("Trip not found");
    if (user.role === "VENDOR" && trip.vendorId !== user.vendorId) return forbidden();
    if (user.role === "DRIVER" && trip.driverId !== user.driverId) return forbidden();
    if (isInternalRole(user.role)) {
      const denied = await authorize(auth, "trip.view");
      if (denied) return denied;
    }
    const documents = await listDocuments("TRIP", params.id);
    return ok(documents);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const user = auth.user;
  try {
    const trip = await prisma.trip.findFirst({ where: { id: params.id } });
    if (!trip) return notFound("Trip not found");
    if (user.role === "VENDOR" && trip.vendorId !== user.vendorId) return forbidden();
    if (user.role === "DRIVER" && trip.driverId !== user.driverId) return forbidden();

    const formData = await req.formData();
    const rawType = String(formData.get("type") || "OTHER");
    const type = ALLOWED_TYPES.includes(rawType) ? rawType : "OTHER";

    if (type === "POD") {
      if (!canUploadTripPod(trip.status)) {
        return badRequest("POD can only be uploaded after the trip is marked as delivered");
      }
      const pods = await prisma.indentPod.findMany({
        where: { tripId: params.id },
        select: { status: true, resolutionStatus: true },
      });
      if (tripPodAlreadySubmitted(deriveTripPodQueueState(pods))) {
        return badRequest(POD_ALREADY_SUBMITTED_MESSAGE);
      }
      const front = formData.get("front");
      const back = formData.get("back");
      const legacy = formData.get("file");

      if (front instanceof File && back instanceof File) {
        if (front.size === 0 || back.size === 0) return badRequest("POD files cannot be empty");
        if (front.size > MAX_SIZE || back.size > MAX_SIZE) return badRequest("File too large (max 10 MB)");

        const frontDoc = await uploadTripFile(params.id, front, "POD", user.id, "front");
        const backDoc = await uploadTripFile(params.id, back, "POD", user.id, "back");

        if (frontDoc.fileId && backDoc.fileId && trip.indentId) {
          await uploadPodFromTrip(params.id, frontDoc.fileId, backDoc.fileId, user);
        }

        await logAudit({
          user,
          action: AUDIT_ACTIONS.POD_UPLOADED,
          entity: "Trip",
          entityId: params.id,
          meta: { by: user.role, pendingVerification: true, dualImage: true },
        });

        return created({ front: frontDoc, back: backDoc });
      }

      if (legacy instanceof File) {
        return badRequest("Both front and back POD images are required");
      }

      return badRequest("Both front and back POD images are required");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) return badRequest("No file uploaded");
    if (file.size === 0) return badRequest("File is empty");
    if (file.size > MAX_SIZE) return badRequest("File too large (max 10 MB)");

    const doc = await uploadDocument({
      ownerType: "trip",
      ownerId: params.id,
      documentType: type,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
      uploadedById: user.id,
    });

    return created(doc);
  } catch (e) {
    return serverError(e);
  }
}
