import { requireAuth, authorize, ok, notFound, serverError, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { verifyVendorBeneficiary } from "@/lib/payments/beneficiary.service";

export const runtime = "nodejs";

type Params = { params: { id: string; beneficiaryId: string } };

export async function POST(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.process");
  if (denied) return denied;

  try {
    const row = await prisma.vendorBeneficiary.findFirst({
      where: { id: params.beneficiaryId, vendorId: params.id },
    });
    if (!row) return notFound();
    const verified = await verifyVendorBeneficiary(params.beneficiaryId, auth.user);
    return ok(verified);
  } catch (e) {
    return serverError(e);
  }
}
