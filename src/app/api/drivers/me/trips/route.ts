import { requireAuth, forbidden, unauthorized, safeOk } from "@/lib/api";
import { listDriverTrips } from "@/lib/services/driver.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "DRIVER" || !auth.user.driverId) return forbidden();

  const url = new URL(req.url);
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);

  return safeOk(
    "driver.trips",
    () => listDriverTrips(auth.user.driverId!, { page, limit }),
    { items: [], page: 1, total: 0 }
  );
}
