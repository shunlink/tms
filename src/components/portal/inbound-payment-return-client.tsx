"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readJsonBody } from "@/lib/api-client";

type OrderStatus = {
  status: string;
  settled?: boolean;
  amount?: number;
  providerStatus?: string | null;
  paymentLinkUrl?: string | null;
};

export default function InboundPaymentReturnClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/portal/client/payments/orders/${orderId}`);
        const data = (await readJsonBody(res)) as OrderStatus;
        if (!res.ok) throw new Error("Could not load payment status");
        if (!cancelled) setOrder(data);
        if (data.settled || data.status === "SUCCEEDED") return;
        if (data.status === "FAILED" || data.status === "CANCELLED") return;
        setTimeout(poll, 3000);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const done = order?.settled || order?.status === "SUCCEEDED";
  const failed = order?.status === "FAILED" || order?.status === "CANCELLED";

  return (
    <div className="max-w-lg mx-auto space-y-4 text-center py-12">
      <h1 className="text-2xl font-bold text-gray-950">Payment status</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !order && <p className="text-sm text-gray-600">Confirming your payment…</p>}
      {order && (
        <p className="text-sm text-gray-700">
          Status: <strong>{order.providerStatus ?? order.status}</strong>
          {order.amount != null ? ` · ₹${order.amount.toFixed(2)}` : null}
        </p>
      )}
      {done && <p className="text-green-700 font-medium">Payment received. Thank you.</p>}
      {failed && <p className="text-amber-700">Payment was not completed. You can try again from your invoice.</p>}
      {order?.paymentLinkUrl && !done && (
        <a
          href={order.paymentLinkUrl}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800"
        >
          Continue to payment
        </a>
      )}
      <Link
        href="/portal/client/invoices"
        className="inline-flex items-center justify-center rounded-md border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        Back to invoices
      </Link>
    </div>
  );
}
