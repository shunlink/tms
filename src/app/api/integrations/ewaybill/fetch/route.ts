import { requireAuth, authorize, ok, badRequest, serverError } from "@/lib/api";
import { handleIntegrationError } from "@/lib/integrations/core/api";
import { fetchEWayBill, upsertIndentEwayBill } from "@/lib/integrations/ewaybill/service";
import { validate } from "@/lib/validation";
import { z } from "zod";

const bodySchema = z.object({
  ewayBillNumber: z.string().trim().min(1, "E-Way Bill number is required"),
  indentId: z.string().optional(),
  persist: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.edit");
  if (denied) return denied;

  try {
    const body = await req.json();
    const parsed = validate(bodySchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const result = await fetchEWayBill(parsed.data.ewayBillNumber);

    if (parsed.data.persist && parsed.data.indentId) {
      await upsertIndentEwayBill(
        parsed.data.indentId,
        { ...result.data, mode: "EXISTING" },
        auth!.user
      );
    }

    return ok({ success: true, data: result.data });
  } catch (e) {
    const handled = handleIntegrationError(e);
    if (handled) return handled;
    return serverError(e);
  }
}
