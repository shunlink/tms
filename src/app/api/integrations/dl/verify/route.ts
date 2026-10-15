import { requireAuth, authorizeAny, ok, badRequest, serverError } from "@/lib/api";
import { handleIntegrationError } from "@/lib/integrations/core/api";
import { applyDlVerificationToDriver, verifyDrivingLicence } from "@/lib/integrations/dl/service";
import { validate } from "@/lib/validation";
import { z } from "zod";

const bodySchema = z.object({
  dlNumber: z.string().trim().min(4, "DL number is required"),
  dateOfBirth: z.string().trim().optional().nullable(),
  driverId: z.string().optional(),
  persist: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorizeAny(auth, ["driver.create", "driver.verify"]);
  if (denied) return denied;

  try {
    const body = await req.json();
    const parsed = validate(bodySchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const result = await verifyDrivingLicence(parsed.data.dlNumber, parsed.data.dateOfBirth);

    if (parsed.data.persist && parsed.data.driverId) {
      await applyDlVerificationToDriver(parsed.data.driverId, result.data, auth!.user);
    }

    return ok({ success: true, valid: result.valid, data: result.data });
  } catch (e) {
    const handled = handleIntegrationError(e);
    if (handled) return handled;
    return serverError(e);
  }
}
