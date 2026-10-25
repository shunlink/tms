import {
  requireAuth,
  authorize,
  ok,
  badRequest,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api";
import { balancePaymentActionSchema, validate } from "@/lib/validation";
import { validateUploadedFile } from "@/lib/document-validation";
import {
  getBalancePaymentTaskById,
  approveBalancePayable,
  processBalancePayment,
  recordBalancePayment,
} from "@/lib/services/vendor-balance-payment.service";
import {
  approveAndExecuteGatewayPayment,
  startBalanceGatewayPayment,
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

  const denied = await authorize(auth, "payment.view");
  if (denied) {
    const tripDenied = await authorize(auth, "trip.view");
    if (tripDenied) return denied;
  }

  try {
    const task = await getBalancePaymentTaskById(params.id, auth.user);
    if (!task) return notFound("Balance payment task not found");
    return ok(task);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let body: Record<string, unknown> = {};
    let proof: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = {
        action: String(formData.get("action") ?? ""),
        paymentMode: formData.get("paymentMode") ? String(formData.get("paymentMode")) : undefined,
        utrReference: formData.get("utrReference") ? String(formData.get("utrReference")) : undefined,
        chequeNumber: formData.get("chequeNumber") ? String(formData.get("chequeNumber")) : undefined,
        amount: formData.get("amount"),
        paidAt: formData.get("paidAt") ? String(formData.get("paidAt")) : undefined,
        remarks: formData.get("remarks") ? String(formData.get("remarks")) : undefined,
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

    const parsed = validate(balancePaymentActionSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const { action, paymentMode, utrReference, chequeNumber, amount, paidAt, remarks, beneficiaryId, paymentId } =
      parsed.data;

    if (action === "gateway_initiate") {
      const denied = await authorize(auth, "payment.process");
      if (denied) return denied;
      if (!beneficiaryId) return badRequest("Beneficiary is required");
      if (!amount || amount <= 0) return badRequest("Amount is required");
      const payment = await startBalanceGatewayPayment(
        params.id,
        { amountRupees: amount, beneficiaryId },
        auth.user
      );
      if (!payment) return badRequest("Could not start bank transfer");
      return ok({ gatewayPayment: mapGatewayPayment(payment) });
    }

    if (action === "gateway_approve_execute") {
      const denied = await authorize(auth, "payment.approve");
      if (denied) return denied;
      if (!paymentId) return badRequest("paymentId is required");
      const payment = await approveAndExecuteGatewayPayment(paymentId, auth.user);
      if (!payment) return badRequest("Could not approve or execute transfer");
      return ok({ gatewayPayment: mapGatewayPayment(payment) });
    }

    if (action === "approve") {
      const denied = await authorize(auth, "payment.approve");
      if (denied) return denied;
      const result = await approveBalancePayable(params.id, auth.user, remarks);
      if (!result) return notFound("Balance payment task not found");
      return ok(result);
    }

    if (action === "process") {
      const denied = await authorize(auth, "payment.process");
      if (denied) return denied;
      const result = await processBalancePayment(
        params.id,
        { paymentMode, paymentDetails: utrReference, remarks },
        auth.user
      );
      if (!result) return notFound("Balance payment task not found");
      return ok(result);
    }

    if (action === "record_payment") {
      const denied = await authorize(auth, "payment.process");
      if (denied) return denied;
      if (!amount || amount <= 0) return badRequest("Amount is required");
      if (!paidAt) return badRequest("Payment date is required");
      if (!paymentMode) return badRequest("Payment method is required");
      const result = await recordBalancePayment(
        params.id,
        {
          amount,
          paidAt,
          paymentMode,
          utrReference,
          chequeNumber,
          remarks,
        },
        auth.user,
        proof
      );
      if (!result) return notFound("Balance payment task not found");
      return ok(result);
    }

    return badRequest("Unknown action");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Balance payment action failed";
    if (msg.includes("Cannot") || msg.includes("must be") || msg.includes("required") || msg.includes("Invalid") || msg.includes("exceeds")) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
