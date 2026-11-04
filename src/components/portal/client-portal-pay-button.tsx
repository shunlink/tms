"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { readJsonBody, resolveApiError } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import { formatINR } from "@/lib/utils";

export default function ClientPortalPayButton({
  purpose,
  invoiceId,
  tripId,
  outstanding,
  maxPayAmount,
  checkoutCapRupees,
  disabled,
}: {
  purpose: "INVOICE" | "TRIP_ADVANCE";
  invoiceId?: string;
  tripId?: string;
  outstanding: number;
  /** Max allowed for one online checkout (may be below outstanding during Juspay restricted mode). */
  maxPayAmount?: number;
  checkoutCapRupees?: number | null;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const payMax = maxPayAmount ?? outstanding;
  const [amount, setAmount] = useState(String(payMax > 0 ? payMax : ""));

  async function pay() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.push({ variant: "error", title: "Enter a valid amount" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/portal/client/payments/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose,
          invoiceId,
          tripId,
          amount: value,
          idempotencyKey: `${purpose}-${invoiceId ?? tripId}-${Date.now()}`,
        }),
      });
      const data = (await readJsonBody(res)) as {
        paymentLinkUrl?: string | null;
        id?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(resolveApiError(res, data, "Could not start payment").message);

      if (data.paymentLinkUrl) {
        window.location.href = data.paymentLinkUrl;
        return;
      }
      toast.push({
        variant: "error",
        title:
          "Payment gateway did not return a checkout link. Check Juspay API key, merchant id, and NEXT_PUBLIC_APP_URL (must be HTTPS for local dev).",
      });
    } catch (e) {
      toast.push({
        variant: "error",
        title: e instanceof Error ? e.message : "Payment failed",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end print:hidden">
      <label className="text-xs font-medium text-gray-600 flex flex-col gap-1">
        Pay amount (₹)
        <input
          type="number"
          min={1}
          step="0.01"
          max={payMax}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-full sm:w-40"
          disabled={disabled || loading}
        />
      </label>
      {checkoutCapRupees != null && outstanding > checkoutCapRupees ? (
        <p className="text-[11px] text-amber-800 col-span-full sm:col-span-2">
          Online pay is capped at ₹{checkoutCapRupees.toLocaleString("en-IN")} per checkout until Juspay lifts
          restricted mode. You can pay the rest in a second payment.
        </p>
      ) : null}
      <Button type="button" onClick={pay} disabled={disabled || loading || payMax <= 0}>
        {loading ? "Starting…" : `Pay ${formatINR(Number(amount) || outstanding)}`}
      </Button>
    </div>
  );
}
