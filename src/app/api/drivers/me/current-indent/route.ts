import { requireAuth, ok, forbidden, unauthorized, safeOk } from "@/lib/api";
import { getDriverCurrentIndent } from "@/lib/services/driver.service";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "DRIVER" || !auth.user.driverId) return forbidden();
  return safeOk("driver.currentIndent", () => getDriverCurrentIndent(auth.user.driverId!), null);
}
