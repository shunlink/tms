"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { readJsonBody, resolveApiError } from "@/lib/api-client";
import { useToast } from "@/components/toast";

export default function ClientPaymentJuspayRefundButton({
  inboundOrderId,
  maxAmount,
}: {
  inboundOrderId: string;
  maxAmount: number;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function refund() {
    if (!confirm(`Refund full Juspay payment of ₹${maxAmount.toFixed(2)}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/inbound-payments/${inboundOrderId}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: maxAmount, reason: "Finance-initiated refund" }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) throw new Error(resolveApiError(res, data, "Refund failed").message);
      toast.push({ variant: "success", title: "Refund initiated with Juspay" });
    } catch (e) {
      toast.push({
        variant: "error",
        title: e instanceof Error ? e.message : "Refund failed",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={refund}>
      {loading ? "Refunding…" : "Refund via Juspay"}
    </Button>
  );
}
