import { requireAuth, authorize, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import { deleteTripCharge } from "@/lib/services/trip-charge.service";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; chargeId: string } }
) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.process");
  if (denied) return denied;

  try {
    const result = await deleteTripCharge(params.chargeId, auth.user);
    if (!result) return notFound("Charge not found");
    return ok({ deleted: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete charge";
    if (msg.includes("Cannot")) return badRequest(msg);
    return serverError(e);
  }
}
