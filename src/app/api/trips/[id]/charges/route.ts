import {
  requireAuth,
  authorize,
  ok,
  created,
  badRequest,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api";
import { tripChargeSchema, validate } from "@/lib/validation";
import { listTripCharges, createTripCharge } from "@/lib/services/trip-charge.service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.view");
  if (denied) return denied;

  try {
    const charges = await listTripCharges(params.id);
    return ok(charges);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.process");
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(tripChargeSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const charge = await createTripCharge(
      params.id,
      {
        chargeType: parsed.data.chargeType,
        amount: parsed.data.amount,
        description: parsed.data.description,
      },
      auth.user
    );
    return created(charge);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add charge";
    if (msg.includes("not found") || msg.includes("Cannot") || msg.includes("Invalid")) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
