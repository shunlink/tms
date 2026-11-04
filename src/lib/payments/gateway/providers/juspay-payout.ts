import { prisma } from "../../../prisma";
import { minorToRupees } from "../../money";
import { juspayRequest } from "../../juspay/client";
import { generateJuspayOrderId } from "../../juspay/order-id";
import {
  juspayHypercheckoutWebhookCredentials,
  juspayPayoutWebhookCredentials,
} from "../../juspay/config";
import { verifyJuspayWebhookBasicAuth } from "../../juspay/webhook-auth";
import type { PaymentGateway } from "../interface";
import type {
  InitiateTransferRequest,
  InitiateTransferResult,
  NormalizedTransferStatus,
  NormalizedWebhookEvent,
  QueryTransferResult,
} from "../types";

type PayoutOrderResponse = {
  orderId?: string;
  status?: string;
  fulfillments?: Array<{ id?: string; transactions?: Array<{ gatewayRefId?: string; status?: string }> }>;
};

const PAYOUT_SUCCESS = new Set(["FULFILLMENTS_SUCCESSFUL"]);
const PAYOUT_FAILURE = new Set(["FULFILLMENTS_FAILURE", "FULFILLMENTS_CANCELLED"]);
const PAYOUT_PROCESSING = new Set(["READY_FOR_FULFILLMENT", "FULFILLMENTS_SCHEDULED"]);

function mapPayoutStatus(status: string | undefined): NormalizedTransferStatus {
  if (!status) return "PROCESSING";
  if (PAYOUT_SUCCESS.has(status)) return "SUCCEEDED";
  if (PAYOUT_FAILURE.has(status)) return "FAILED";
  if (status === "FULFILLMENTS_MANUAL_REVIEW") return "AMBIGUOUS";
  if (PAYOUT_PROCESSING.has(status)) return "PROCESSING";
  return "PROCESSING";
}

function payoutUtrFromOrder(order: PayoutOrderResponse): string | null {
  for (const f of order.fulfillments ?? []) {
    for (const t of f.transactions ?? []) {
      if (t.gatewayRefId) return t.gatewayRefId;
    }
  }
  return null;
}

function classifyWebhookPayload(data: Record<string, unknown>): "inbound" | "outbound" {
  const status = String(data.status ?? "");
  if (data.fulfillments || PAYOUT_SUCCESS.has(status) || PAYOUT_PROCESSING.has(status)) {
    return "outbound";
  }
  if (data.txn_detail || status === "CHARGED" || data.order_id) {
    return "inbound";
  }
  return "outbound";
}

function hypercheckoutAmountMinor(data: Record<string, unknown>): number | undefined {
  const amount = data.amount;
  if (typeof amount === "number") {
    return amount >= 1000 ? Math.round(amount) : Math.round(amount * 100);
  }
  if (typeof amount === "string") {
    const n = Number(amount);
    if (!Number.isNaN(n)) return Math.round(n * 100);
  }
  const txn = data.txn_detail as { txn_amount?: number; net_amount?: number } | undefined;
  if (txn?.txn_amount != null) {
    const v = txn.txn_amount;
    return v >= 1000 ? Math.round(v) : Math.round(v * 100);
  }
  return undefined;
}

export function createJuspayPayoutGateway(): PaymentGateway {
  return {
    id: "juspay",
    capabilities: {
      supportsWebhooks: true,
      supportsStatusPolling: true,
      supportsIdempotentInitiate: true,
    },

    async initiateTransfer(req: InitiateTransferRequest): Promise<InitiateTransferResult> {
      const payment = await prisma.outboundPayment.findUnique({
        where: { id: req.internalPaymentId },
        include: {
          beneficiary: true,
          vendor: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
      if (!payment?.beneficiary) {
        throw new Error("Beneficiary required for Juspay payout");
      }

      let juspayOrderId = payment.juspayOrderId;
      if (!juspayOrderId) {
        juspayOrderId = generateJuspayOrderId("P");
        await prisma.outboundPayment.update({
          where: { id: payment.id },
          data: { juspayOrderId },
        });
      }

      const bene = payment.beneficiary;
      const amountRupees = minorToRupees(req.amountMinor);
      const routingId = payment.vendorId;

      const customerEmail = payment.vendor.email?.trim() || "finance@tms.local";
      const customerPhone = payment.vendor.phone?.replace(/\D/g, "").slice(-10) || "9999999999";

      type BenePayload =
        | { type: "BENE_ID"; details: { id: string; name?: string } }
        | {
            type: "ACCOUNT_IFSC";
            details: { name: string; account: string; ifsc: string };
          }
        | { type: "UPI_ID"; details: { name: string; vpa: string; mobileNo?: string } };

      let beneficiaryDetails: BenePayload;
      if (bene.providerBeneficiaryRef) {
        beneficiaryDetails = {
          type: "BENE_ID",
          details: { id: bene.providerBeneficiaryRef, name: bene.accountHolder ?? payment.vendor.name },
        };
      } else if (bene.method === "UPI" && bene.upiId) {
        beneficiaryDetails = {
          type: "UPI_ID",
          details: {
            name: bene.accountHolder ?? payment.vendor.name,
            vpa: bene.upiId,
            mobileNo: customerPhone,
          },
        };
      } else if (bene.accountNumber && bene.ifsc) {
        beneficiaryDetails = {
          type: "ACCOUNT_IFSC",
          details: {
            name: bene.accountHolder ?? payment.vendor.name,
            account: bene.accountNumber,
            ifsc: bene.ifsc,
          },
        };
      } else {
        throw new Error("Beneficiary missing account details for payout");
      }

      if (process.env.NODE_ENV === "production" && !bene.providerBeneficiaryRef) {
        throw new Error("Juspay beneficiary must be validated (BENE_ID) before payout in production");
      }

      if (bene.providerBeneficiaryRef) {
        const { refreshJuspayBeneficiaryStatus } = await import("../../juspay-beneficiary.service");
        await refreshJuspayBeneficiaryStatus(bene.id);
        const refreshed = await prisma.vendorBeneficiary.findUnique({ where: { id: bene.id } });
        if (
          process.env.NODE_ENV === "production" &&
          refreshed?.juspayValidationStatus &&
          refreshed.juspayValidationStatus !== "VALID"
        ) {
          throw new Error("Juspay beneficiary validation is not VALID yet");
        }
      }

      const body = {
        orderId: juspayOrderId,
        type: "FULFILL_ONLY",
        amount: amountRupees,
        customerId: payment.vendorId,
        customerPhone,
        customerEmail,
        fulfillments: [
          {
            amount: amountRupees,
            beneficiaryDetails,
            additionalInfo: {
              remark: `TMS ${payment.purpose} ${payment.paymentNumber}`,
            },
            udf1: payment.id,
          },
        ],
        udf1: payment.id,
      };

      const result = await juspayRequest<PayoutOrderResponse>({
        method: "POST",
        path: "/payout/merchant/v1/orders",
        routingId,
        body,
      });

      const fulfillmentId = result.fulfillments?.[0]?.id ?? null;
      await prisma.outboundPayment.update({
        where: { id: payment.id },
        data: {
          providerFulfillmentId: fulfillmentId,
          providerTransferRef: juspayOrderId,
        },
      });

      return {
        providerRef: juspayOrderId,
        status: mapPayoutStatus(result.status),
        raw: result,
      };
    },

    async queryTransfer(providerRef: string): Promise<QueryTransferResult> {
      const payment = await prisma.outboundPayment.findFirst({
        where: { OR: [{ juspayOrderId: providerRef }, { providerTransferRef: providerRef }] },
      });
      const routingId = payment?.vendorId ?? providerRef;

      const result = await juspayRequest<PayoutOrderResponse>({
        method: "GET",
        path: `/payout/merchant/v1/orders/${encodeURIComponent(providerRef)}?expand=fulfillment,payment,refund`,
        routingId,
      });

      return {
        providerRef,
        status: mapPayoutStatus(result.status),
        utr: payoutUtrFromOrder(result),
        failureMessage: PAYOUT_FAILURE.has(result.status ?? "") ? result.status : undefined,
        raw: result,
      };
    },

    verifyWebhookSignature(headers: Headers, _rawBody: string): boolean {
      const payoutOk = verifyJuspayWebhookBasicAuth(headers, juspayPayoutWebhookCredentials());
      if (payoutOk) return true;
      return verifyJuspayWebhookBasicAuth(headers, juspayHypercheckoutWebhookCredentials());
    },

    parseWebhookEvent(rawBody: string): NormalizedWebhookEvent {
      const data = JSON.parse(rawBody) as Record<string, unknown>;
      const channel = classifyWebhookPayload(data);

      const eventId =
        String(data.event_id ?? data.id ?? data.order_id ?? data.orderId ?? "") +
        ":" +
        String(data.status ?? data.event ?? "evt");

      if (channel === "outbound") {
        const orderId = String(data.orderId ?? data.order_id ?? "");
        return {
          channel: "outbound",
          providerEventId: eventId.slice(0, 120) || `payout:${Date.now()}`,
          providerRef: orderId || undefined,
          internalPaymentId: data.udf1 ? String(data.udf1) : undefined,
          status: mapPayoutStatus(String(data.status ?? "")),
          utr: payoutUtrFromOrder(data as PayoutOrderResponse),
          amountMinor: typeof data.amount === "number" ? Math.round(Number(data.amount) * 100) : undefined,
        };
      }

      const orderId = String(data.order_id ?? data.orderId ?? "");
      return {
        channel: "inbound",
        providerEventId: eventId.slice(0, 120) || `hc:${Date.now()}`,
        providerRef: orderId || undefined,
        inboundOrderId: data.udf1 ? String(data.udf1) : undefined,
        status: String(data.status) === "CHARGED" ? "SUCCEEDED" : "PROCESSING",
        utr:
          (data.payment_gateway_response as { rrn?: string } | undefined)?.rrn ??
          (data.txn_id as string | undefined) ??
          null,
        amountMinor: hypercheckoutAmountMinor(data),
      };
    },

    mapError(error: unknown) {
      const message = error instanceof Error ? error.message : "Juspay error";
      const status = (error as { status?: number }).status;
      const retryable = status == null || status >= 500 || status === 429;
      return { category: "PROVIDER", code: "JUSPAY_ERROR", message, retryable };
    },
  };
}

/** Cancel payout fulfillment at Juspay (best-effort). */
export async function cancelJuspayPayoutFulfillment(fulfillmentId: string, routingId: string) {
  return juspayRequest<{ status?: string }>({
    method: "POST",
    path: `/payout/merchant/v1/fulfillment/${encodeURIComponent(fulfillmentId)}/cancel`,
    routingId,
  });
}
