import { prisma } from "@/lib/prisma";
import { validateBiddingIntegrationRequest } from "@/lib/integration/bidding/auth";
import { biddingCompanyIdQuerySchema } from "@/lib/integration/bidding/schemas";
import {
  resolveBiddingVendorTripId,
  resolveVendorIdByBiddingCompany,
  resolveVendorPortalActorForBidding,
} from "@/lib/services/bidding-integration.service";
import { uploadDocument } from "@/lib/services/document.service";
import { uploadPodFromTrip } from "@/lib/services/pod.service";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024;

async function uploadTripFile(
  tripId: string,
  file: File,
  suffix: string,
  vendorUserId: string | null
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
    uploadedById: vendorUserId,
  });
}

export async function POST(req: Request, { params }: { params: { tripId: string } }) {
  const authError = validateBiddingIntegrationRequest(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const parsed = biddingCompanyIdQuerySchema.safeParse({
    biddingCompanyId: searchParams.get("biddingCompanyId"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const vendorId = await resolveVendorIdByBiddingCompany(parsed.data.biddingCompanyId);
  if (!vendorId) {
    return Response.json({ error: "Vendor not linked", code: "VENDOR_NOT_LINKED" }, { status: 404 });
  }

  const resolvedTripId = await resolveBiddingVendorTripId(vendorId, params.tripId.trim());
  if (!resolvedTripId) {
    return Response.json({ error: "Trip not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const trip = await prisma.trip.findFirst({
    where: { id: resolvedTripId, vendorId },
    select: { id: true, indentId: true, indent: { select: { source: true } } },
  });
  if (!trip || trip.indent?.source !== "BIDDING") {
    return Response.json({ error: "Trip not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const formData = await req.formData();
  const front = formData.get("front");
  const back = formData.get("back");
  const remarks = formData.get("remarks");

  if (!(front instanceof File) || !(back instanceof File)) {
    return Response.json({ error: "front and back files are required", code: "VALIDATION_ERROR" }, { status: 400 });
  }
  if (front.size === 0 || back.size === 0) {
    return Response.json({ error: "POD files cannot be empty", code: "VALIDATION_ERROR" }, { status: 400 });
  }
  if (front.size > MAX_SIZE || back.size > MAX_SIZE) {
    return Response.json({ error: "File too large (max 10 MB)", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const requestedByEmailRaw = formData.get("requestedByEmail");
  const requestedByEmail =
    typeof requestedByEmailRaw === "string" && requestedByEmailRaw.trim()
      ? requestedByEmailRaw.trim()
      : null;
  const actor = await resolveVendorPortalActorForBidding(vendorId, requestedByEmail);
  const actorUserId = actor?.id ?? null;

  const frontDoc = await uploadTripFile(resolvedTripId, front, "front", actorUserId);
  const backDoc = await uploadTripFile(resolvedTripId, back, "back", actorUserId);

  const pod = await uploadPodFromTrip(
    resolvedTripId,
    frontDoc.fileId,
    backDoc.fileId,
    actor,
    typeof remarks === "string" ? remarks : null
  );

  if (!pod) {
    return Response.json({ error: "POD upload not allowed for trip status", code: "INVALID_STATE" }, { status: 400 });
  }

  return Response.json(
    {
      podId: pod.id,
      status: pod.status,
      indentId: trip.indentId,
    },
    { status: 201 }
  );
}
