import {
  requireAuth,
  authorize,
  ok,
  badRequest,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api";
import { clientPaymentUpdateSchema, validate } from "@/lib/validation";
import { validateUploadedFile } from "@/lib/document-validation";
import { getClientPaymentById, updateClientPayment } from "@/lib/services/client-payment.service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "client.payment.manage");
  if (denied) {
    const viewDenied = await authorize(auth, "invoice.view");
    if (viewDenied) return denied;
  }

  try {
    const payment = await getClientPaymentById(params.id);
    if (!payment) return notFound("Client payment not found");
    return ok(payment);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "client.payment.manage");
  if (denied) return denied;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let data: Record<string, unknown> = {};
    let proof: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      for (const key of ["clientId", "paymentType", "amount", "paidAt", "paymentMode", "referenceNo", "notes", "invoiceId", "indentId", "tripId"]) {
        const val = formData.get(key);
        if (val != null && val !== "") data[key] = key === "amount" ? val : String(val);
      }
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

    const parsed = validate(clientPaymentUpdateSchema, data);
    if (!parsed.success) return badRequest(parsed.error);

    const payment = await updateClientPayment(params.id, parsed.data, auth.user, proof);
    if (!payment) return notFound("Client payment not found");
    return ok(payment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update client payment";
    if (msg.includes("not found") || msg.includes("Invalid") || msg.includes("must be")) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
