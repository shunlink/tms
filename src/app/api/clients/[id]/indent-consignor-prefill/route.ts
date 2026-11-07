import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, notFound, serverError } from "@/lib/api";
import { buildConsignorPrefillFromClient } from "@/lib/client-indent-consignor-prefill";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "client.view");
  if (denied) return denied;

  try {
    const client = await prisma.client.findFirst({
      where: { id: params.id, deletedAt: null },
      select: {
        name: true,
        legalName: true,
        gstin: true,
        gstVerificationData: true,
      },
    });
    if (!client) return notFound("Client not found");

    const prefill = buildConsignorPrefillFromClient({
      name: client.name,
      legalName: client.legalName,
      gstin: client.gstin,
      gstVerificationData: client.gstVerificationData,
    });

    return ok(prefill);
  } catch (e) {
    return serverError(e);
  }
}
