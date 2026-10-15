import {
  requireAuth,
  authorize,
  ok,
  created,
  badRequest,
  serverError,
  unauthorized,
} from "@/lib/api";
import { vendorPaymentSchema, validate } from "@/lib/validation";
import { validateUploadedFile } from "@/lib/document-validation";
import { createVendorPayment, listVendorPayments } from "@/lib/services/vendor-payment.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const tripId = url.searchParams.get("tripId") ?? undefined;
    const paymentType = url.searchParams.get("paymentType") ?? undefined;
    const payments = await listVendorPayments({ vendorId, tripId, paymentType });
    return ok(payments);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.create");
  if (denied) return denied;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let data: Record<string, unknown> = {};
    let proof: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      data = {
        vendorId: String(formData.get("vendorId") ?? ""),
        tripId: String(formData.get("tripId") ?? ""),
        paymentType: String(formData.get("paymentType") ?? "BALANCE"),
        amount: formData.get("amount"),
        paidAt: String(formData.get("paidAt") ?? ""),
        paymentMode: formData.get("paymentMode") ? String(formData.get("paymentMode")) : undefined,
        referenceNo: formData.get("referenceNo") ? String(formData.get("referenceNo")) : undefined,
        chequeNumber: formData.get("chequeNumber") ? String(formData.get("chequeNumber")) : undefined,
        notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
      };
      const file = formData.get("proof");
      if (file instanceof File && file.size > 0) {
        const fileCheck = validateUploadedFile({ name: file.name, size: file.size, type: file.type });
        if (!fileCheck.ok) return badRequest(fileCheck.message);
        proof = {
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          buffer: Buffer.from(await file.arrayBuffer()),
        };
      }
    } else {
      data = await req.json();
    }

    const parsed = validate(vendorPaymentSchema, data);
    if (!parsed.success) return badRequest(parsed.error);

    const payment = await createVendorPayment(
      {
        vendorId: parsed.data.vendorId,
        tripId: parsed.data.tripId,
        paymentType: parsed.data.paymentType,
        amount: parsed.data.amount,
        paidAt: parsed.data.paidAt,
        paymentMode: parsed.data.paymentMode,
        referenceNo: parsed.data.referenceNo,
        chequeNumber: parsed.data.chequeNumber,
        notes: parsed.data.notes,
        advanceAmount: parsed.data.advanceAmount ?? undefined,
        tdsAmount: parsed.data.tdsAmount ?? undefined,
      },
      proof,
      auth.user
    );
    return created(payment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to record vendor payment";
    if (msg.includes("required") || msg.includes("Invalid") || msg.includes("not found")) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
