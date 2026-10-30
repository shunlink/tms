import { prisma } from "@/lib/prisma";
import { listDocuments, uploadDocument } from "@/lib/services/document.service";
import { getDriverIdForAuthUser, resolveDriverAccessibleTrip } from "@/lib/services/driver.service";
import { uploadTripPodFromMultipart } from "@/lib/services/trip-pod-document-upload.service";
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

function tripIdFromDocumentsRequest(req: Request, params: { id?: string }) {
  const fromPath = new URL(req.url).pathname.match(/\/api\/trips\/([^/]+)\/documents\/?$/i)?.[1];
  const fromParams = params.id?.trim();
  const id = (fromPath ?? fromParams ?? "").trim();
  if (id === "documents" || id === "[id]") return fromPath?.trim() ?? "";
  return id;
}

async function loadTripForDriverDocuments(
  user: { id?: string; role?: string; driverId?: string | null; vendorId?: string | null },
  tripOrIndentId: string
) {
  const key = tripOrIndentId.trim();
  if (!key) return { error: notFound("Trip not found") };

  if (user.role === "DRIVER") {
    const driverId = await getDriverIdForAuthUser(user);
    if (!driverId) {
      return { error: forbidden("Your account is not linked to a driver profile. Contact dispatch.") };
    }
    const resolved = await resolveDriverAccessibleTrip(driverId, key);
    if (!resolved) {
      const exists = await prisma.trip.findFirst({
        where: { OR: [{ id: key }, { indentId: key }] },
        select: { id: true },
      });
      if (exists) return { error: forbidden("This trip is not assigned to you") };
      return { error: notFound("Trip not found") };
    }
    const trip = await prisma.trip.findFirst({
      where: { id: resolved.id },
      select: { id: true, vendorId: true, driverId: true, status: true, indentId: true },
    });
    if (!trip) return { error: notFound("Trip not found") };
    return { trip };
  }

  const trip = await prisma.trip.findFirst({
    where: { id: key },
    select: { id: true, vendorId: true, driverId: true, status: true, indentId: true },
  });
  if (!trip) return { error: notFound("Trip not found") };
  if (user.role === "VENDOR" && trip.vendorId !== user.vendorId) {
    return { error: forbidden() };
  }
  return { trip };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const user = auth.user;
  try {
    const loaded = await loadTripForDriverDocuments(user, tripIdFromDocumentsRequest(req, params));
    if ("error" in loaded && loaded.error) return loaded.error;
    const trip = loaded.trip!;
    if (isInternalRole(user.role)) {
      const denied = await authorize(auth, "trip.view");
      if (denied) return denied;
    }
    const documents = await listDocuments("TRIP", trip.id);
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
    const tripKey = tripIdFromDocumentsRequest(req, params);
    const formData = await req.formData();
    const tripIdFromForm = String(formData.get("tripId") ?? "").trim();
    const loaded = await loadTripForDriverDocuments(user, tripIdFromForm || tripKey);
    if ("error" in loaded && loaded.error) return loaded.error;
    const trip = loaded.trip!;
    const rawType = String(formData.get("type") || "OTHER");
    const type = ALLOWED_TYPES.includes(rawType) ? rawType : "OTHER";

    if (type === "POD") {
      return uploadTripPodFromMultipart(trip, user, formData);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) return badRequest("No file uploaded");
    if (file.size === 0) return badRequest("File is empty");
    if (file.size > MAX_SIZE) return badRequest("File too large (max 10 MB)");

    const doc = await uploadDocument({
      ownerType: "trip",
      ownerId: trip.id,
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
