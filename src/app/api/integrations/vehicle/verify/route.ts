import { requireAuth, authorize, ok, badRequest, serverError } from "@/lib/api";
import { handleIntegrationError } from "@/lib/integrations/core/api";
import { applyRcVerificationToVehicle, verifyVehicleRC } from "@/lib/integrations/vehicle/service";
import { validate } from "@/lib/validation";
import { vehicleRegSchema } from "@/lib/field-validators";
import { z } from "zod";

const bodySchema = z.object({
  registrationNumber: vehicleRegSchema,
  vehicleId: z.string().optional(),
  persist: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vehicle.edit");
  if (denied) return denied;

  try {
    const body = await req.json();
    const parsed = validate(bodySchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const result = await verifyVehicleRC(parsed.data.registrationNumber);

    if (parsed.data.persist && parsed.data.vehicleId) {
      await applyRcVerificationToVehicle(parsed.data.vehicleId, result.data, auth!.user);
    }

    return ok({ success: true, valid: result.valid, data: result.data });
  } catch (e) {
    const handled = handleIntegrationError(e);
    if (handled) return handled;
    return serverError(e);
  }
}
