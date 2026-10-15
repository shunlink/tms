/** Invoice statuses where customer payments cannot be recorded. */
export const NON_PAYABLE_INVOICE_STATUSES = ["DRAFT", "CANCELLED"];

/** Statuses that may only be set via ClientPayment, not generic invoice updates. */
export const PAYMENT_DERIVED_INVOICE_STATUSES = ["PAID", "PARTIALLY_PAID"];

const PARTIALLY_PAYABLE_STATUSES = ["SENT", "UNPAID", "OVERDUE", "PARTIALLY_PAID"];

export function invoiceOutstanding(totalAmount: number, paidAmount: number): number {
  return Math.round((totalAmount - paidAmount) * 100) / 100;
}

export function validateInvoicePaymentAmount(outstanding: number, amount: number): string | null {
  if (amount <= 0) return "Amount must be greater than zero";
  if (amount - outstanding > 0.005) {
    return outstanding <= 0
      ? "Invoice is already fully paid"
      : `Payment exceeds outstanding amount (₹${outstanding.toFixed(2)})`;
  }
  return null;
}

export function computeInvoicePaymentState(
  totalAmount: number,
  currentPaidAmount: number,
  paymentAmount: number,
  currentStatus: string
): { paidAmount: number; outstanding: number; status: string } {
  const newPaid = Math.round((currentPaidAmount + paymentAmount) * 100) / 100;
  let status = currentStatus;
  if (newPaid >= totalAmount) status = "PAID";
  else if (newPaid > 0 && PARTIALLY_PAYABLE_STATUSES.includes(currentStatus)) {
    status = "PARTIALLY_PAID";
  }
  return {
    paidAmount: newPaid,
    outstanding: invoiceOutstanding(totalAmount, newPaid),
    status,
  };
}

export function computeInvoicePaymentRevert(
  totalAmount: number,
  currentPaidAmount: number,
  revertAmount: number,
  currentStatus: string
): { paidAmount: number; outstanding: number; status: string } {
  const newPaid = Math.max(0, Math.round((currentPaidAmount - revertAmount) * 100) / 100);
  let status = currentStatus;
  if (newPaid <= 0) {
    status =
      currentStatus === "PAID" || currentStatus === "PARTIALLY_PAID" ? "UNPAID" : currentStatus;
  } else if (newPaid < totalAmount) {
    status = "PARTIALLY_PAID";
  }
  return {
    paidAmount: newPaid,
    outstanding: invoiceOutstanding(totalAmount, newPaid),
    status,
  };
}

/** Reject direct invoice payment mutation via generic update APIs. */
export function rejectDirectInvoicePaymentFields(input: {
  paidAmount?: number | null;
  status?: string | null;
}): string | null {
  if (input.paidAmount != null) return "Use Record Payment to update paid amount";
  if (
    input.status &&
    PAYMENT_DERIVED_INVOICE_STATUSES.includes(input.status)
  ) {
    return "Use Record Payment to mark invoices as paid";
  }
  return null;
}
