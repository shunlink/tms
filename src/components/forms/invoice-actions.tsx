"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Printer, Send, Receipt } from "lucide-react";

export default function InvoiceActions({
  invoiceId,
  status,
  totalAmount,
  paidAmount,
  clientId,
}: {
  invoiceId: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  clientId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const outstanding = Math.max(0, totalAmount - paidAmount);

  async function finalize() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finalize" }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to finalize invoice");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
      </Button>
      {status === "DRAFT" && (
        <Button onClick={finalize} disabled={busy}>
          <Send className="h-4 w-4 mr-2" />
          {busy ? "Finalizing..." : "Finalize & Send to Client"}
        </Button>
      )}
      {status !== "DRAFT" && status !== "PAID" && outstanding > 0 && (
        <Link
          href={`/client-payments?invoiceId=${invoiceId}&clientId=${clientId}&amount=${outstanding}`}
        >
          <Button>
            <Receipt className="h-4 w-4 mr-2" /> Record Payment
          </Button>
        </Link>
      )}
      {status === "PAID" && (
        <span className="text-sm text-green-600 font-medium">Paid</span>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
