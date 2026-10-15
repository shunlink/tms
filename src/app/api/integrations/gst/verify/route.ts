import { requireAuth, authorizeAny, ok, badRequest, serverError } from "@/lib/api";
import { handleIntegrationError } from "@/lib/integrations/core/api";
import { verifyGSTIN, persistGstVerification } from "@/lib/integrations/gst/service";
import { validate } from "@/lib/validation";
import { gstinSchema } from "@/lib/field-validators";
import { z } from "zod";

const bodySchema = z.object({
  gstin: gstinSchema,
  entityType: z.enum(["CLIENT", "VENDOR"]).optional(),
  entityId: z.string().optional(),
  persist: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return badRequest("Unauthorized");

  try {
    const body = await req.json();
    const parsed = validate(bodySchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const { gstin, entityType, entityId, persist } = parsed.data;

    if (entityType && entityId) {
      const ownsEntity =
        (entityType === "CLIENT" && auth.user.clientId === entityId) ||
        (entityType === "VENDOR" && auth.user.vendorId === entityId);
      if (!ownsEntity) {
        const denied = await authorizeAny(auth, ["client.edit", "vendor.edit"]);
        if (denied) return denied;
      }
    } else {
      const denied = await authorizeAny(auth, ["client.edit", "vendor.edit"]);
      if (denied) return denied;
    }

    const result = await verifyGSTIN(gstin);

    if (persist && entityType && entityId) {
      await persistGstVerification(entityType, entityId, result.data, auth.user);
    }

    return ok({
      success: true,
      valid: result.valid,
      data: result.data,
    });
  } catch (e) {
    const handled = handleIntegrationError(e);
    if (handled) return handled;
    return serverError(e);
  }
}
