import { requireAuth, authorize, ok, badRequest, serverError } from "@/lib/api";
import { handleIntegrationError } from "@/lib/integrations/core/api";
import { generateEWayBill, upsertIndentEwayBill } from "@/lib/integrations/ewaybill/service";
import { validate } from "@/lib/validation";
import { z } from "zod";
import { gstinSchema } from "@/lib/field-validators";

/** Backend-only E-Way Bill generation — not wired to any frontend UI. */
const bodySchema = z.object({
  supplierGstin: gstinSchema,
  recipientGstin: gstinSchema,
  documentType: z.string().trim().min(1),
  documentNumber: z.string().trim().min(1),
  documentDate: z.string().trim().min(1),
  goodsDescription: z.string().trim().min(1),
  hsnCode: z.string().optional().nullable(),
  quantity: z.string().optional().nullable(),
  value: z.coerce.number().optional().nullable(),
  origin: z.string().trim().min(1),
  destination: z.string().trim().min(1),
  vehicleNumber: z.string().trim().min(1),
  transporterGstin: z.string().optional().nullable(),
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

    const d = parsed.data;
    const result = await generateEWayBill({
      supplierGstin: d.supplierGstin,
      recipientGstin: d.recipientGstin,
      documentType: d.documentType,
      documentNumber: d.documentNumber,
      documentDate: d.documentDate,
      goodsDescription: d.goodsDescription,
      hsnCode: d.hsnCode ?? undefined,
      quantity: d.quantity ?? undefined,
      value: d.value ?? undefined,
      origin: d.origin,
      destination: d.destination,
      vehicleNumber: d.vehicleNumber,
      transporterGstin: d.transporterGstin ?? undefined,
    });

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
