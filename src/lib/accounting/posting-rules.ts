import type { DraftJournalLineInput } from "./types";
import { CONTROL_ACCOUNT_CODES } from "./control-accounts";

/** System posting rules — business documents map to balanced journal lines here. */
export type OutboundPaymentPostingContext = {
  paymentId: string;
  amountMinor: number;
  currency: string;
  purpose: string;
  vendorId: string;
  indentId?: string | null;
  tripId?: string | null;
  providerRef?: string | null;
};

function debitAccountForOutboundPurpose(purpose: string): string {
  if (purpose === "ADVANCE") return "2150";
  return "2110";
}

export function buildOutboundPaymentSettlementLines(
  ctx: OutboundPaymentPostingContext
): DraftJournalLineInput[] {
  const desc = `${ctx.purpose} outbound transfer`;
  const debitAccount = debitAccountForOutboundPurpose(ctx.purpose);
  return [
    {
      accountCode: debitAccount,
      debitMinor: ctx.amountMinor,
      description: desc,
      vendorId: ctx.vendorId,
      indentId: ctx.indentId ?? undefined,
      tripId: ctx.tripId ?? undefined,
      outboundPaymentId: ctx.paymentId,
    },
    {
      accountCode: CONTROL_ACCOUNT_CODES.GATEWAY_CLEARING,
      creditMinor: ctx.amountMinor,
      description: desc,
      outboundPaymentId: ctx.paymentId,
    },
  ];
}

export type VendorCashPaymentPostingContext = {
  vendorPaymentId: string;
  amountMinor: number;
  paymentType: "ADVANCE" | "BALANCE" | "OTHER";
  vendorId: string;
  tripId?: string | null;
  indentId?: string | null;
  reference?: string | null;
  /** Bank/cash account — manual settlements use 1010; gateway uses 1015 via outbound path. */
  creditAccountCode?: string;
};

/** Manual (or non-gateway) vendor cash settlement — mirrors outbound debit logic, credits bank. */
export function buildVendorCashPaymentLines(ctx: VendorCashPaymentPostingContext): DraftJournalLineInput[] {
  const purpose = ctx.paymentType === "ADVANCE" ? "ADVANCE" : "BALANCE";
  const debitAccount = debitAccountForOutboundPurpose(purpose);
  const creditAccount = ctx.creditAccountCode ?? CONTROL_ACCOUNT_CODES.BANK_CASH;
  const desc = `Vendor ${ctx.paymentType} payment${ctx.reference ? ` — ${ctx.reference}` : ""}`;
  const dims = {
    vendorId: ctx.vendorId,
    indentId: ctx.indentId ?? undefined,
    tripId: ctx.tripId ?? undefined,
  };
  return [
    { accountCode: debitAccount, debitMinor: ctx.amountMinor, description: desc, ...dims },
    { accountCode: creditAccount, creditMinor: ctx.amountMinor, description: desc, ...dims },
  ];
}

export type ClientReceiptPostingContext = {
  clientPaymentId: string;
  amountMinor: number;
  clientId: string;
  invoiceId?: string | null;
  tripId?: string | null;
  indentId?: string | null;
  reference?: string | null;
};

export function buildClientReceiptLines(ctx: ClientReceiptPostingContext): DraftJournalLineInput[] {
  const desc = `Client receipt${ctx.reference ? ` — ${ctx.reference}` : ""}`;
  return [
    {
      accountCode: CONTROL_ACCOUNT_CODES.BANK_CASH,
      debitMinor: ctx.amountMinor,
      description: desc,
      clientId: ctx.clientId,
      tripId: ctx.tripId ?? undefined,
      indentId: ctx.indentId ?? undefined,
    },
    {
      accountCode: CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      creditMinor: ctx.amountMinor,
      description: desc,
      clientId: ctx.clientId,
      tripId: ctx.tripId ?? undefined,
      indentId: ctx.indentId ?? undefined,
    },
  ];
}

export type VendorPayableAccrualContext = {
  payableId: string;
  finalPayableMinor: number;
  advanceAppliedMinor: number;
  vendorId: string;
  tripId: string;
  indentId?: string | null;
};

/**
 * Recognize vendor freight expense and payable on commercial approval.
 * Matches financial-note VENDOR_FREIGHT_INCREASE mapping (5100 / 2110) at trip level.
 * When advance was already paid (2150), net AP via Dr 2110 / Cr 2150 application lines.
 */
export function buildVendorPayableAccrualLines(ctx: VendorPayableAccrualContext): DraftJournalLineInput[] {
  if (ctx.finalPayableMinor <= 0) {
    throw new Error("Payable accrual requires a positive final payable amount");
  }
  const dims = {
    vendorId: ctx.vendorId,
    tripId: ctx.tripId,
    indentId: ctx.indentId ?? undefined,
  };
  const desc = `Vendor trip payable commercial approval`;
  const lines: DraftJournalLineInput[] = [
    {
      accountCode: "5100",
      debitMinor: ctx.finalPayableMinor,
      description: desc,
      ...dims,
    },
    {
      accountCode: CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES,
      creditMinor: ctx.finalPayableMinor,
      description: desc,
      ...dims,
    },
  ];
  if (ctx.advanceAppliedMinor > 0) {
    lines.push(
      {
        accountCode: CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES,
        debitMinor: ctx.advanceAppliedMinor,
        description: `${desc} — advance applied`,
        ...dims,
      },
      {
        accountCode: CONTROL_ACCOUNT_CODES.VENDOR_ADVANCES,
        creditMinor: ctx.advanceAppliedMinor,
        description: `${desc} — advance applied`,
        ...dims,
      }
    );
  }
  return lines;
}

export type ClientInvoiceAccrualContext = {
  invoiceId: string;
  invoiceNumber: string;
  totalMinor: number;
  clientId: string;
  tripId?: string | null;
};

/**
 * Recognize client receivable on invoice issuance (matches CLIENT_BILLING_INCREASE note mapping).
 * GST is not split — tax control account 2200 is inactive until finance configures it.
 */
export function buildClientInvoiceAccrualLines(ctx: ClientInvoiceAccrualContext): DraftJournalLineInput[] {
  if (ctx.totalMinor <= 0) throw new Error("Invoice accrual requires a positive total");
  const desc = `Invoice ${ctx.invoiceNumber} issued`;
  return [
    {
      accountCode: CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      debitMinor: ctx.totalMinor,
      description: desc,
      clientId: ctx.clientId,
      tripId: ctx.tripId ?? undefined,
    },
    {
      accountCode: "4100",
      creditMinor: ctx.totalMinor,
      description: desc,
      clientId: ctx.clientId,
      tripId: ctx.tripId ?? undefined,
    },
  ];
}
