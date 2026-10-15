import {
  requireAuth,
  authorize,
  ok,
  created,
  badRequest,
  serverError,
  unauthorized,
} from "@/lib/api";
import { clientPaymentSchema, validate } from "@/lib/validation";
import { validateUploadedFile } from "@/lib/document-validation";
import { createClientPayment, listClientPayments } from "@/lib/services/client-payment.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "client.payment.manage");
  if (denied) {
    const viewDenied = await authorize(auth, "invoice.view");
    if (viewDenied) return denied;
  }

  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId") ?? undefined;
    const invoiceId = url.searchParams.get("invoiceId") ?? undefined;
    const paymentType = url.searchParams.get("paymentType") ?? undefined;
    const payments = await listClientPayments({ clientId, invoiceId, paymentType });
    return ok(payments);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
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
      data = {
        clientId: String(formData.get("clientId") ?? ""),
        paymentType: String(formData.get("paymentType") ?? "PAYMENT"),
        amount: formData.get("amount"),
        paidAt: String(formData.get("paidAt") ?? ""),
        paymentMode: formData.get("paymentMode") ? String(formData.get("paymentMode")) : undefined,
        referenceNo: formData.get("referenceNo") ? String(formData.get("referenceNo")) : undefined,
        chequeNumber: formData.get("chequeNumber") ? String(formData.get("chequeNumber")) : undefined,
        notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
        invoiceId: formData.get("invoiceId") ? String(formData.get("invoiceId")) : undefined,
        indentId: formData.get("indentId") ? String(formData.get("indentId")) : undefined,
        tripId: formData.get("tripId") ? String(formData.get("tripId")) : undefined,
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

    const parsed = validate(clientPaymentSchema, data);
    if (!parsed.success) return badRequest(parsed.error);

    const payment = await createClientPayment(
      {
        clientId: parsed.data.clientId,
        paymentType: parsed.data.paymentType,
        amount: parsed.data.amount,
        paidAt: parsed.data.paidAt,
        paymentMode: parsed.data.paymentMode,
        referenceNo: parsed.data.referenceNo,
        chequeNumber: parsed.data.chequeNumber,
        notes: parsed.data.notes,
        invoiceId: parsed.data.invoiceId,
        indentId: parsed.data.indentId,
        tripId: parsed.data.tripId,
      },
      auth.user,
      proof
    );
    return created(payment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to record client payment";
    if (msg.includes("not found") || msg.includes("Invalid") || msg.includes("must be")) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
