import type { SessionUser } from "../auth";
import {
  approveOutboundPayment,
  createAdvanceGatewayPayment,
  createBalanceGatewayPayment,
  executeOutboundPayment,
  getOutboundPayment,
  submitOutboundPaymentForApproval,
} from "./payment.service";
import { pollTransferStatus } from "./execution.service";
import { processPendingPaymentOutbox } from "./outbox";

export async function startBalanceGatewayPayment(
  taskId: string,
  input: { amountRupees: number; beneficiaryId: string },
  actor?: SessionUser | null
) {
  const draft = await createBalanceGatewayPayment(taskId, input.amountRupees, input.beneficiaryId, actor);
  const submitted = await submitOutboundPaymentForApproval(draft!.id, actor);
  return submitted;
}

export async function startAdvanceGatewayPayment(
  advanceRequestId: string,
  input: { beneficiaryId: string; amountRupees?: number },
  actor?: SessionUser | null
) {
  const draft = await createAdvanceGatewayPayment(advanceRequestId, input.beneficiaryId, actor);
  if (input.amountRupees != null && input.amountRupees > 0 && draft) {
    // Amount is fixed at approved cap on create; partial advance gateway not supported yet.
  }
  const submitted = await submitOutboundPaymentForApproval(draft!.id, actor);
  return submitted;
}

export async function approveAndExecuteGatewayPayment(paymentId: string, actor?: SessionUser | null) {
  const approved = await approveOutboundPayment(paymentId, { decision: "APPROVED" }, actor);
  if (!approved) return null;
  return executeOutboundPayment(paymentId, actor);
}

/** Poll provider + outbox until status is refreshed (for UI after Pay now). */
export async function refreshGatewayPaymentStatus(paymentId: string) {
  await processPendingPaymentOutbox(5);
  const payment = await getOutboundPayment(paymentId);
  if (payment && ["PROCESSING", "REQUIRES_REVIEW"].includes(payment.status)) {
    await pollTransferStatus(paymentId);
  }
  return getOutboundPayment(paymentId);
}
