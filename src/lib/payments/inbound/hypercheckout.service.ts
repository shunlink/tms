import { juspayRequest } from "../juspay/client";
import {
  appPublicBaseUrl,
  juspayConfigured,
  juspayMerchantId,
  juspayPaymentPageClientId,
} from "../juspay/config";
import { minorToRupees } from "../money";

export type SessionCreateInput = {
  juspayOrderId: string;
  amountMinor: number;
  clientId: string;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  description: string;
  returnUrl: string;
  udf1?: string;
  udf2?: string;
};

export type SessionCreateResult = {
  paymentLinkWeb: string | null;
  sdkPayload: unknown;
  providerStatus: string;
};

type SessionResponse = {
  status?: string;
  order_id?: string;
  payment_links?: { web?: string };
  sdk_payload?: unknown;
  error_code?: string;
};

export function hypercheckoutEnabled(): boolean {
  return juspayConfigured() && Boolean(process.env.JUSPAY_PAYMENT_PAGE_CLIENT_ID?.trim());
}

export async function createHypercheckoutSession(input: SessionCreateInput): Promise<SessionCreateResult> {
  if (!hypercheckoutEnabled()) {
    throw new Error("Online payments are not configured");
  }

  const amount = minorToRupees(input.amountMinor).toFixed(2);
  const phone = input.customerPhone.replace(/\D/g, "").slice(-10) || "9999999999";
  const [firstName, ...rest] = input.customerName.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  try {
    const result = await juspayRequest<SessionResponse>({
      method: "POST",
      path: "/session",
      routingId: input.clientId,
      body: {
        order_id: input.juspayOrderId,
        amount,
        customer_id: input.clientId,
        customer_email: input.customerEmail,
        customer_phone: phone,
        payment_page_client_id: juspayPaymentPageClientId(),
        action: "paymentPage",
        return_url: input.returnUrl,
        description: input.description,
        first_name: firstName,
        last_name: lastName,
        currency: "INR",
        udf1: input.udf1,
        udf2: input.udf2,
      },
    });

    const paymentLinkWeb = result.payment_links?.web ?? null;
    assertPaymentLink(paymentLinkWeb, input.returnUrl);

    return {
      paymentLinkWeb,
      sdkPayload: result.sdk_payload ?? null,
      providerStatus: result.status ?? "NEW",
    };
  } catch (err) {
    const body = (err as { body?: { error_code?: string } }).body;
    if (body?.error_code === "DUPLICATE_ORDER_ID") {
      try {
        const status = await getHypercheckoutOrderStatus(input.juspayOrderId, input.clientId);
        assertPaymentLink(status.paymentLinkWeb, input.returnUrl);
        return {
          paymentLinkWeb: status.paymentLinkWeb,
          sdkPayload: null,
          providerStatus: status.status,
        };
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

function assertHypercheckoutReturnUrl(returnUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(returnUrl);
  } catch {
    throw new Error("Invalid return URL for Juspay checkout");
  }
  if (parsed.protocol !== "https:") {
    throw new Error(
      "Juspay requires an HTTPS return URL. Set NEXT_PUBLIC_APP_URL to your public HTTPS URL (e.g. ngrok) for local testing."
    );
  }
}

function assertPaymentLink(link: string | null | undefined, returnUrl: string) {
  assertHypercheckoutReturnUrl(returnUrl);
  if (!link) {
    throw new Error(
      "Juspay did not return a payment link. Check JUSPAY_PAYMENT_PAGE_CLIENT_ID and return URL settings in the Juspay dashboard."
    );
  }
}

type OrderStatusResponse = {
  status?: string;
  order_id?: string;
  amount?: number;
  payment_links?: { web?: string };
  txn_id?: string;
  payment_gateway_response?: { rrn?: string };
};

export async function getHypercheckoutOrderStatus(orderId: string, routingId: string) {
  const result = await juspayRequest<OrderStatusResponse>({
    method: "GET",
    path: `/orders/${encodeURIComponent(orderId)}`,
    routingId,
  });

  return {
    status: result.status ?? "UNKNOWN",
    amountMinor: normalizeHypercheckoutAmount(result.amount),
    paymentLinkWeb: result.payment_links?.web ?? null,
    txnId: result.txn_id ?? null,
    rrn: result.payment_gateway_response?.rrn ?? null,
  };
}

export function normalizeHypercheckoutAmount(amount: number | undefined): number | undefined {
  if (amount == null) return undefined;
  if (amount >= 1000) return Math.round(amount);
  return Math.round(amount * 100);
}

export async function cancelHypercheckoutOrder(orderId: string, routingId: string, reason: string) {
  return juspayRequest<{ status?: string; message?: string }>({
    method: "POST",
    path: `/merchants/${encodeURIComponent(juspayMerchantId())}/order/${encodeURIComponent(orderId)}/cancel`,
    routingId,
    body: { cancel_reason: reason },
  });
}

export async function refundHypercheckoutOrder(input: {
  orderId: string;
  routingId: string;
  uniqueRequestId: string;
  amountRupees: number;
  description?: string;
}) {
  const meta = input.description ? JSON.stringify({ description: input.description }) : undefined;
  return juspayRequest<unknown>({
    method: "POST",
    path: `/orders/${encodeURIComponent(input.orderId)}/refunds`,
    routingId: input.routingId,
    contentType: "application/x-www-form-urlencoded",
    body: {
      unique_request_id: input.uniqueRequestId,
      amount: input.amountRupees.toFixed(2),
      ...(meta ? { metaData: meta } : {}),
    },
  });
}

export function defaultInboundReturnUrl(inboundOrderId: string): string {
  return `${appPublicBaseUrl()}/portal/client/payments/orders/${inboundOrderId}/return`;
}
