import type { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { badRequest, created } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { uploadDocument } from "@/lib/services/document.service";
import { uploadPodFromTrip } from "@/lib/services/pod.service";
import {
  canUploadTripPod,
  deriveTripPodQueueState,
  POD_ALREADY_SUBMITTED_MESSAGE,
  tripPodAlreadySubmitted,
} from "@/lib/pod-upload-eligibility";
import { prisma } from "@/lib/prisma";

import { readMultipartFile } from "@/lib/multipart-file";

const MAX_SIZE = 10 * 1024 * 1024;

async function uploadTripFile(
  tripId: string,
  file: File,
  userId: string,
  suffix: string
) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return uploadDocument({
    ownerType: "trip",
    ownerId: tripId,
    documentType: "POD",
    fileName: `${suffix}-${file.name}`,
    mimeType: file.type,
    sizeBytes: file.size,
    buffer: bytes,
    uploadedById: userId,
  });
}

export async function uploadTripPodFromMultipart(
  trip: { id: string; status: string; indentId: string | null },
  user: SessionUser & { id: string },
  formData: FormData
): Promise<NextResponse> {
  if (!canUploadTripPod(trip.status)) {
    return badRequest("POD can only be uploaded after the trip is marked as delivered");
  }

  const pods = await prisma.indentPod.findMany({
    where: { tripId: trip.id },
    select: { status: true, resolutionStatus: true },
  });
  if (tripPodAlreadySubmitted(deriveTripPodQueueState(pods))) {
    return badRequest(POD_ALREADY_SUBMITTED_MESSAGE);
  }

  const front = await readMultipartFile(formData.get("front"), "front-pod.jpg");
  const back = await readMultipartFile(formData.get("back"), "back-pod.jpg");
  const legacy = formData.get("file");

  if (!front || !back) {
    if (legacy instanceof File) {
      return badRequest("Both front and back POD images are required");
    }
    return badRequest("Both front and back POD images are required");
  }

  if (front.size > MAX_SIZE || back.size > MAX_SIZE) {
    return badRequest("File too large (max 10 MB)");
  }

  const frontDoc = await uploadTripFile(trip.id, front, user.id, "front");
  const backDoc = await uploadTripFile(trip.id, back, user.id, "back");

  if (frontDoc.fileId && backDoc.fileId && trip.indentId) {
    await uploadPodFromTrip(trip.id, frontDoc.fileId, backDoc.fileId, user);
  }

  await logAudit({
    user,
    action: AUDIT_ACTIONS.POD_UPLOADED,
    entity: "Trip",
    entityId: trip.id,
    meta: { by: user.role, pendingVerification: true, dualImage: true },
  });

  return created({ front: frontDoc, back: backDoc });
}
