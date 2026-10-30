import { requireAuth, ok, forbidden, unauthorized, serverError } from "@/lib/api";
import { listDriverTripHistoryForMobile } from "@/lib/services/driver.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "DRIVER" || !auth.user.driverId) return forbidden();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 30));

  try {
    const data = await listDriverTripHistoryForMobile(auth.user.driverId!, page, limit);
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}
