import { requireAuth, authorize, ok, created, badRequest, serverError, unauthorized } from "@/lib/api";
import {
  createVendorBeneficiary,
  listVendorBeneficiaries,
} from "@/lib/payments/beneficiary.service";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.view");
  if (denied) return denied;

  try {
    const rows = await listVendorBeneficiaries(params.id);
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.process");
  if (denied) return denied;

  try {
    const body = await req.json();
    const row = await createVendorBeneficiary(params.id, body, auth.user);
    return created(row);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Failed to create beneficiary");
  }
}
