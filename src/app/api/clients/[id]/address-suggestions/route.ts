import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { AddressSuggestionSide } from "@/lib/address-suggestion";
import { getAddressSuggestions } from "@/lib/services/address-suggestion.service";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const sideRaw = (url.searchParams.get("side") ?? "").trim().toLowerCase();
    const q = url.searchParams.get("q") ?? "";

    if (sideRaw !== "consignor" && sideRaw !== "consignee") {
      return badRequest("side must be consignor or consignee");
    }
    const side = sideRaw as AddressSuggestionSide;

    const client = await prisma.client.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true },
    });
    if (!client) return notFound("Client not found");

    const suggestions = await getAddressSuggestions({
      clientId: params.id,
      side,
      q,
    });

    return ok({ suggestions });
  } catch (e) {
    return serverError(e);
  }
}
