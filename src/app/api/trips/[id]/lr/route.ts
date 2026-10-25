import { requireAuth, authorize, ok, notFound, serverError } from "@/lib/api";
import { getTripLrDocument } from "@/lib/services/lr-document.service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "trip.view");
  if (denied) return denied;
  try {
    const doc = await getTripLrDocument(params.id);
    if (!doc.ok || !doc.url) return notFound(doc.error ?? "LR not found");
    return ok({
      url: doc.url,
      generatedAt: doc.generatedAt,
      fileId: doc.fileId,
    });
  } catch (e) {
    return serverError(e);
  }
}
