import { randomUUID } from "crypto";
import { prisma } from "../../prisma";
import { invoiceOutstanding, NON_PAYABLE_INVOICE_STATUSES, validateInvoicePaymentAmount } from "../../invoice-payment";
import { generateJuspayOrderId } from "../juspay/order-id";
import { juspayMaxCheckoutRupees } from "../juspay/config";
import {
  createHypercheckoutSession,
  defaultInboundReturnUrl,
  hypercheckoutEnabled,
} from "./hypercheckout.service";
import { dispatchInboundOutboxJob } from "./inbound-queue";

const ACTIVE_INBOUND = ["CREATED", "PENDING_CHECKOUT", "PROCESSING"];

function isJuspayOrderNotFound(err: unknown): boolean {
  const e = err as { status?: number; body?: { error_info?: { code?: string } } };
  return e.status === 400 && e.body?.error_info?.code === "RESOURCE_NOT_FOUND";
}

async function cancelStaleInboundOrderLocally(inboundOrderId: string, reason: string) {
  await prisma.inboundPaymentOrder.update({
    where: { id: inboundOrderId },
    data: {
      status: "CANCELLED",
      failureMessage: reason,
      paymentLinkUrl: null,
    },
  });
}

/** Returns false if the provider has no such order — local row is cancelled so Pay can start fresh. */
async function reconcileOpenInboundOrderWithProvider(inboundOrderId: string, clientId: string): Promise<boolean> {
  const row = await prisma.inboundPaymentOrder.findFirst({
    where: { id: inboundOrderId, clientId, status: { in: ACTIVE_INBOUND } },
  });
  if (!row) return false;

  try {
    const { getHypercheckoutOrderStatus } = await import("./hypercheckout.service");
    await getHypercheckoutOrderStatus(row.juspayOrderId, row.clientId);
    return true;
  } catch (e) {
    if (isJuspayOrderNotFound(e)) {
      await cancelStaleInboundOrderLocally(
        row.id,
        "Stale checkout — not found at Juspay (retry Pay to start a new session)"
      );
      return false;
    }
    throw e;
  }
}

function n(v: unknown): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export async function createInboundPaymentOrder(input: {
  clientId: string;
  purpose: "INVOICE" | "TRIP_ADVANCE";
  invoiceId?: string | null;
  tripId?: string | null;
  amountRupees: number;
  idempotencyKey?: string;
}) {
  if (!hypercheckoutEnabled()) throw new Error("Online payments are not enabled");
  if (input.amountRupees <= 0) throw new Error("Amount must be greater than zero");

  const maxCheckout = juspayMaxCheckoutRupees();
  if (maxCheckout != null && input.amountRupees - maxCheckout > 0.005) {
    throw new Error(
      `Checkout is limited to ₹${maxCheckout.toLocaleString("en-IN")} per payment on your Juspay account (restricted mode). Enter a smaller amount or complete Juspay QA to raise the limit.`
    );
  }

  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const existing = await prisma.inboundPaymentOrder.findUnique({ where: { idempotencyKey } });
  if (existing) return getInboundOrderForClient(existing.id, input.clientId);

  if (input.purpose === "INVOICE") {
    if (!input.invoiceId) throw new Error("invoiceId is required");
    const invoice = await prisma.clientInvoice.findFirst({
      where: { id: input.invoiceId, clientId: input.clientId },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (NON_PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new Error(`Cannot pay a ${invoice.status.toLowerCase()} invoice`);
    }
    const outstanding = invoiceOutstanding(n(invoice.totalAmount), n(invoice.paidAmount));
    const err = validateInvoicePaymentAmount(outstanding, input.amountRupees);
    if (err) throw new Error(err);

    const open = await prisma.inboundPaymentOrder.findFirst({
      where: {
        clientId: input.clientId,
        invoiceId: input.invoiceId,
        status: { in: ACTIVE_INBOUND },
      },
    });
    if (open) {
      const stillOpen = await reconcileOpenInboundOrderWithProvider(open.id, input.clientId);
      if (stillOpen) {
        return ensureInboundCheckoutReady(open.id, input.clientId);
      }
    }
  }

  if (input.purpose === "TRIP_ADVANCE") {
    if (!input.tripId) throw new Error("tripId is required");
    const trip = await prisma.trip.findFirst({
      where: { id: input.tripId, clientId: input.clientId },
    });
    if (!trip) throw new Error("Trip not found");

    const open = await prisma.inboundPaymentOrder.findFirst({
      where: {
        clientId: input.clientId,
        tripId: input.tripId,
        purpose: "TRIP_ADVANCE",
        status: { in: ACTIVE_INBOUND },
      },
    });
    if (open) {
      const stillOpen = await reconcileOpenInboundOrderWithProvider(open.id, input.clientId);
      if (stillOpen) {
        return ensureInboundCheckoutReady(open.id, input.clientId);
      }
    }
  }

  const client = await prisma.client.findFirst({ where: { id: input.clientId } });
  if (!client) throw new Error("Client not found");

  const amountMinor = Math.round(input.amountRupees * 100);
  const juspayOrderId = generateJuspayOrderId("C");

  const order = await prisma.inboundPaymentOrder.create({
    data: {
      clientId: input.clientId,
      purpose: input.purpose,
      invoiceId: input.invoiceId ?? null,
      tripId: input.tripId ?? null,
      amountMinor,
      status: "CREATED",
      idempotencyKey,
      juspayOrderId,
    },
  });

  const returnUrl = defaultInboundReturnUrl(order.id);
  const description =
    input.purpose === "INVOICE"
      ? `Invoice payment`
      : `Trip advance payment`;

  const session = await createHypercheckoutSession({
    juspayOrderId,
    amountMinor,
    clientId: input.clientId,
    customerEmail: client.email?.trim() || client.accountsEmail?.trim() || "client@tms.local",
    customerPhone: client.phone?.trim() || "9999999999",
    customerName: client.name,
    description,
    returnUrl,
    udf1: order.id,
    udf2: input.invoiceId ?? input.tripId ?? undefined,
  });

  const updated = await prisma.inboundPaymentOrder.update({
    where: { id: order.id },
    data: {
      status: "PENDING_CHECKOUT",
      paymentLinkUrl: session.paymentLinkWeb,
      returnUrl,
      providerStatus: session.providerStatus,
    },
  });

  return mapInboundOrder(updated, session.paymentLinkWeb);
}

/** Re-create Juspay session when an open order has no checkout link (e.g. prior auth failure). */
export async function refreshInboundCheckoutSessionIfNeeded(inboundOrderId: string, clientId: string) {
  const row = await prisma.inboundPaymentOrder.findFirst({
    where: { id: inboundOrderId, clientId, status: { in: ACTIVE_INBOUND } },
  });
  if (!row || row.paymentLinkUrl?.trim()) return;

  await createSessionForInboundRow(row, clientId);
}

async function createSessionForInboundRow(
  row: {
    id: string;
    juspayOrderId: string;
    amountMinor: number;
    purpose: string;
    invoiceId: string | null;
    tripId: string | null;
    returnUrl: string | null;
  },
  clientId: string
) {
  const client = await prisma.client.findFirst({ where: { id: clientId } });
  if (!client) throw new Error("Client not found");

  const returnUrl = row.returnUrl ?? defaultInboundReturnUrl(row.id);
  const description = row.purpose === "INVOICE" ? "Invoice payment" : "Trip advance payment";

  const session = await createHypercheckoutSession({
    juspayOrderId: row.juspayOrderId,
    amountMinor: row.amountMinor,
    clientId,
    customerEmail: client.email?.trim() || client.accountsEmail?.trim() || "client@tms.local",
    customerPhone: client.phone?.trim() || "9999999999",
    customerName: client.name,
    description,
    returnUrl,
    udf1: row.id,
    udf2: row.invoiceId ?? row.tripId ?? undefined,
  });

  await prisma.inboundPaymentOrder.update({
    where: { id: row.id },
    data: {
      status: "PENDING_CHECKOUT",
      paymentLinkUrl: session.paymentLinkWeb,
      returnUrl,
      providerStatus: session.providerStatus,
    },
  });
}

async function rotateJuspayOrderId(inboundOrderId: string) {
  const newId = generateJuspayOrderId("C");
  await prisma.inboundPaymentOrder.update({
    where: { id: inboundOrderId },
    data: {
      juspayOrderId: newId,
      paymentLinkUrl: null,
      status: "CREATED",
    },
  });
}

/** Ensure open checkout has a payment link; rotate provider order id once if session cannot be created. */
async function ensureInboundCheckoutReady(inboundOrderId: string, clientId: string) {
  await refreshInboundCheckoutSessionIfNeeded(inboundOrderId, clientId);
  let view = await getInboundOrderForClient(inboundOrderId, clientId);
  if (view?.paymentLinkUrl) return view;

  try {
    await rotateJuspayOrderId(inboundOrderId);
    await refreshInboundCheckoutSessionIfNeeded(inboundOrderId, clientId);
  } catch (e) {
    if (!isJuspayOrderNotFound(e)) throw e;
    await cancelStaleInboundOrderLocally(inboundOrderId, "Checkout expired at Juspay");
    throw new Error("Previous checkout expired. Click Pay again.");
  }

  view = await getInboundOrderForClient(inboundOrderId, clientId);
  if (!view?.paymentLinkUrl) {
    throw new Error(
      "Juspay did not return a payment link. Check JUSPAY_PAYMENT_PAGE_CLIENT_ID and NEXT_PUBLIC_APP_URL."
    );
  }
  return view;
}

export async function getInboundOrderForClient(orderId: string, clientId: string) {
  const row = await prisma.inboundPaymentOrder.findFirst({
    where: { id: orderId, clientId },
    include: { clientPayment: { select: { id: true, amount: true, paidAt: true } } },
  });
  if (!row) return null;
  return mapInboundOrder(row, row.paymentLinkUrl);
}

export async function cancelInboundPaymentOrder(orderId: string, clientId: string, reason: string) {
  const row = await prisma.inboundPaymentOrder.findFirst({
    where: { id: orderId, clientId },
  });
  if (!row) return null;
  if (!ACTIVE_INBOUND.includes(row.status)) {
    throw new Error(`Cannot cancel order in status ${row.status}`);
  }

  try {
    const { cancelHypercheckoutOrder } = await import("./hypercheckout.service");
    await cancelHypercheckoutOrder(row.juspayOrderId, row.clientId, reason);
  } catch {
    // Local cancel still applies if provider order is not ACTIVE.
  }

  const updated = await prisma.inboundPaymentOrder.update({
    where: { id: row.id },
    data: { status: "CANCELLED", failureMessage: reason },
  });
  return mapInboundOrder(updated, null);
}

export async function pollInboundOrderStatus(orderId: string) {
  const row = await prisma.inboundPaymentOrder.findUnique({ where: { id: orderId } });
  if (!row) return;
  if (row.status === "SUCCEEDED" || row.status === "CANCELLED") return;

  try {
    const { getHypercheckoutOrderStatus } = await import("./hypercheckout.service");
    const status = await getHypercheckoutOrderStatus(row.juspayOrderId, row.clientId);

    await prisma.inboundPaymentOrder.update({
      where: { id: row.id },
      data: {
        providerStatus: status.status,
        providerTxnId: status.txnId,
        status: status.status === "CHARGED" ? "PROCESSING" : row.status,
      },
    });

    if (status.status === "CHARGED") {
      const { settleInboundPaymentSuccess } = await import("./inbound-settlement.service");
      await settleInboundPaymentSuccess(row.id, {
        providerAmountMinor: status.amountMinor,
        referenceNo: status.rrn ?? status.txnId ?? row.juspayOrderId,
      });
    }
  } catch (e) {
    if (isJuspayOrderNotFound(e)) {
      await cancelStaleInboundOrderLocally(
        row.id,
        "Checkout not found at Juspay — use Pay on the invoice to start again"
      );
      return;
    }
    console.error("[inbound] Juspay status poll failed:", e instanceof Error ? e.message : e);
  }
}

export async function enqueueInboundPoll(orderId: string) {
  const outbox = await prisma.inboundPaymentOutbox.create({
    data: {
      inboundOrderId: orderId,
      jobType: "POLL_STATUS",
      status: "PENDING",
      nextAttemptAt: new Date(),
    },
  });
  await dispatchInboundOutboxJob(outbox.id);
}

function mapInboundOrder(
  row: {
    id: string;
    purpose: string;
    status: string;
    amountMinor: number;
    juspayOrderId: string;
    paymentLinkUrl: string | null;
    invoiceId: string | null;
    tripId: string | null;
    providerStatus: string | null;
    financeSettledAt: Date | null;
    createdAt: Date;
  },
  paymentLinkUrl: string | null
) {
  return {
    id: row.id,
    purpose: row.purpose,
    status: row.status,
    amount: row.amountMinor / 100,
    amountMinor: row.amountMinor,
    juspayOrderId: row.juspayOrderId,
    paymentLinkUrl: paymentLinkUrl ?? row.paymentLinkUrl,
    invoiceId: row.invoiceId,
    tripId: row.tripId,
    providerStatus: row.providerStatus,
    settled: Boolean(row.financeSettledAt),
    createdAt: row.createdAt,
  };
}

export async function listInboundOrdersForClient(clientId: string, limit = 50) {
  const rows = await prisma.inboundPaymentOrder.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => mapInboundOrder(r, r.paymentLinkUrl));
}
