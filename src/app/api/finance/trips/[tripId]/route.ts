import { requireAuth, authorizeAny, notFound, ok } from "@/lib/api";
import { getTripFinance, serializeTripFinance } from "@/lib/services/trip-finance.service";

export async function GET(
  _req: Request,
  { params }: { params: { tripId: string } }
) {
  const auth = await requireAuth();
  const denied = await authorizeAny(auth, ["payment.view", "invoice.view"]);
  if (denied) return denied;

  const finance = await getTripFinance(params.tripId);
  if (!finance) return notFound("Trip not found");

  return ok(serializeTripFinance(finance));
}
