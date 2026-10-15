import { requireAuth, authorize, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import {
  advanceActionSchema,
  advanceNegotiateSchema,
  advancePaymentSchema,
  externalAdvanceUpdateSchema,
  validate,
} from "@/lib/validation";
import { validateUploadedFile } from "@/lib/document-validation";
import {
  approveAdvanceRequest,
  completeAdvancePayment,
  getAdvanceRequestById,
  negotiateAdvanceRequest,
  processAdvanceRequest,
  rejectAdvanceRequest,
  updateExternalAdvanceRecord,
} from "@/lib/services/trip-advance.service";
import {
  approveAndExecuteGatewayPayment,
  startAdvanceGatewayPayment,
} from "@/lib/payments/workflow.service";

function mapGatewayPayment(p: {
  id: string;
  paymentNumber: string;
  status: string;
  amount: number;
  providerTransferRef: string | null;
  createdBy: { id: string } | null;
  failureMessage: string | null;
}) {
  return {
    id: p.id,
    paymentNumber: p.paymentNumber,
    status: p.status,
    amount: p.amount,
    providerTransferRef: p.providerTransferRef,
    createdById: p.createdBy?.id ?? null,
    failureMessage: p.failureMessage,
  };
}

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "advance.view");
  if (denied) return denied;

  try {
    const request = await getAdvanceRequestById(params.id);
    if (!request) return notFound("Advance request not found");
    return ok(request);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  let proof: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    body = {
      action: String(formData.get("action") ?? ""),
      negotiatedAmount: formData.get("negotiatedAmount"),
      remarks: formData.get("remarks") ? String(formData.get("remarks")) : undefined,
      paidAmount: formData.get("paidAmount"),
      paymentMethod: formData.get("paymentMethod") ? String(formData.get("paymentMethod")) : undefined,
      paymentDate: formData.get("paymentDate") ? String(formData.get("paymentDate")) : undefined,
      utrReference: formData.get("utrReference") ? String(formData.get("utrReference")) : undefined,
      bankAccountUsed: formData.get("bankAccountUsed") ? String(formData.get("bankAccountUsed")) : undefined,
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
    body = await req.json().catch(() => ({}));
  }

  try {
    if (body.action === "update_external") {
      const denied = await authorize(auth, "advance.decide");
      if (denied) return denied;
      const ext = validate(externalAdvanceUpdateSchema, body);
      if (!ext.success) return badRequest(ext.error);
      const result = await updateExternalAdvanceRecord(
        params.id,
        {
          requestedAmount: ext.data.requestedAmount,
          approvedAmount: ext.data.approvedAmount,
          externalReference: ext.data.externalReference,
          remarks: ext.data.remarks,
        },
        auth.user
      );
      if (!result) return notFound("External advance record not found");
      return ok(result);
    }

    const parsed = validate(advanceActionSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const { action, remarks, beneficiaryId, paymentId, amount } = parsed.data;

    if (action === "gateway_initiate") {
      const denied = await authorize(auth, "advance.process");
      if (denied) return denied;
      if (!beneficiaryId) return badRequest("Beneficiary is required");
      const payment = await startAdvanceGatewayPayment(
        params.id,
        { beneficiaryId, amountRupees: amount ?? undefined },
        auth.user
      );
      if (!payment) return badRequest("Could not start bank transfer");
      return ok({ gatewayPayment: mapGatewayPayment(payment) });
    }

    if (action === "gateway_approve_execute") {
      const denied = await authorize(auth, "advance.process");
      if (denied) return denied;
      if (!paymentId) return badRequest("paymentId is required");
      const payment = await approveAndExecuteGatewayPayment(paymentId, auth.user);
      if (!payment) return badRequest("Could not approve or execute transfer");
      return ok({ gatewayPayment: mapGatewayPayment(payment) });
    }

    if (action === "approve") {
      const denied = await authorize(auth, "advance.decide");
      if (denied) return denied;
      const result = await approveAdvanceRequest(params.id, { remarks }, auth.user);
      if (!result) return notFound("Advance request not found");
      return ok(result);
    }

    if (action === "negotiate") {
      const denied = await authorize(auth, "advance.decide");
      if (denied) return denied;
      const neg = validate(advanceNegotiateSchema, body);
      if (!neg.success) return badRequest(neg.error);
      const result = await negotiateAdvanceRequest(
        params.id,
        { negotiatedAmount: neg.data.negotiatedAmount, remarks: neg.data.remarks },
        auth.user
      );
      if (!result) return notFound("Advance request not found");
      return ok(result);
    }

    if (action === "reject") {
      const denied = await authorize(auth, "advance.decide");
      if (denied) return denied;
      const result = await rejectAdvanceRequest(params.id, { remarks }, auth.user);
      if (!result) return notFound("Advance request not found");
      return ok(result);
    }

    if (action === "process") {
      const denied = await authorize(auth, "advance.process");
      if (denied) return denied;
      const payment = validate(advancePaymentSchema, body);
      if (!payment.success) return badRequest(payment.error);
      const result = await processAdvanceRequest(params.id, payment.data, auth.user);
      if (!result) return notFound("Advance request not found");
      return ok(result);
    }

    if (action === "mark_processed") {
      const denied = await authorize(auth, "advance.markPaid");
      if (denied) return denied;
      const payment = validate(advancePaymentSchema, body);
      if (!payment.success) return badRequest(payment.error);
      const result = await completeAdvancePayment(params.id, payment.data, proof, auth.user);
      if (!result) return notFound("Advance request not found");
      return ok(result);
    }

    return badRequest("Unknown action");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Advance action failed";
    if (
      msg.includes("Cannot") ||
      msg.includes("must be") ||
      msg.includes("Invalid") ||
      msg.includes("required") ||
      msg.includes("cannot exceed")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
