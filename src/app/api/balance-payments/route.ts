import { requireAuth, authorize, ok, serverError, unauthorized } from "@/lib/api";
import { listBalancePaymentTasks } from "@/lib/services/vendor-balance-payment.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const denied = await authorize(auth, "payment.view");
  if (denied) {
    const tripDenied = await authorize(auth, "trip.view");
    if (tripDenied) return denied;
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const slaBreachedOnly = searchParams.get("slaBreachedOnly") === "true";
    const tripId = searchParams.get("tripId") ?? undefined;

    const tasks = await listBalancePaymentTasks(
      { status, slaBreachedOnly, tripId },
      auth.user
    );
    return ok(tasks);
  } catch (e) {
    return serverError(e);
  }
}
