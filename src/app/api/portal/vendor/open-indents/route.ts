import { requireAuth, unauthorized, forbidden, safeOk } from "@/lib/api";
import { listOpenIndentsForVendor } from "@/lib/services/quote.service";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "VENDOR" || !auth.user.vendorId) return forbidden();
  return safeOk("vendor.openIndents", () => listOpenIndentsForVendor(auth.user.vendorId!), []);
}
