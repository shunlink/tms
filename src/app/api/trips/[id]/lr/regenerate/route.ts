import { requireAuth, authorize, ok, notFound, badRequest, serverError } from "@/lib/api";
import { regenerateTripLrPdf } from "@/lib/services/lr-document.service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "trip.edit");
  if (denied) return denied;
  try {
    const trip = await prisma.trip.findFirst({ where: { id: params.id }, select: { id: true } });
    if (!trip) return notFound("Trip not found");
    const result = await regenerateTripLrPdf(params.id, auth!.user);
    if (!result.ok) return badRequest(result.error ?? "Failed to regenerate LR");
    return ok({
      url: result.url,
      generatedAt: result.generatedAt,
      fileId: result.fileId,
    });
  } catch (e) {
    return serverError(e);
  }
}
