import { requireAuth, authorize, notFound, ok } from "@/lib/api";
import { getVendorPayableSummary } from "@/lib/services/payables.service";

export async function GET(
  _req: Request,
  { params }: { params: { vendorId: string } }
) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "payment.view");
  if (denied) return denied;

  const summary = await getVendorPayableSummary(params.vendorId);
  if (!summary) return notFound("Vendor not found");

  return ok(summary);
}
