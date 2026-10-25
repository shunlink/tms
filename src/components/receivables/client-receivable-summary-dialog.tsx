"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/utils";
import type { ClientReceivableSummary } from "@/lib/services/receivables.service";

import { readJsonBody, resolveApiError } from "@/lib/api-client";
import { useToast } from "@/components/toast";
export default function ClientReceivableSummaryDialog({
  clientId,
  clientName,
  open,
  onClose,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ClientReceivableSummary | null>(null);

  useEffect(() => {
    if (!open || !clientId) return;
    setLoading(true);
    setError("");
    fetch(`/api/receivables/client/${clientId}`)
      .then(async (res) => {
        const data = await readJsonBody(res);
        if (!res.ok) {
          throw new Error(resolveApiError(res, data, "Failed to load client summary").message);
        }
        return data;
      })
      .then((data) => setSummary(data as ClientReceivableSummary))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, clientId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-heading text-lg font-semibold">{clientName}</h2>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>

        <div className="p-4 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {summary && !loading && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Total invoiced</p>
                  <p className="font-semibold">{formatINR(summary.totalInvoiced)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Total collected</p>
                  <p className="font-semibold text-green-700">{formatINR(summary.totalCollected)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Outstanding</p>
                  <p className="font-semibold">{formatINR(summary.totalOutstanding)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Overdue</p>
                  <p className="font-semibold text-red-600">{formatINR(summary.overdue)}</p>
                </div>
                <div className="rounded-lg border p-3 col-span-2">
                  <p className="text-muted-foreground">Open invoices</p>
                  <p className="font-semibold">{summary.invoiceCount}</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Recent payments</h3>
                {summary.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {summary.payments.slice(0, 10).map((p) => (
                      <li key={p.id} className="flex justify-between border-b pb-2">
                        <span>
                          {formatDate(p.paidAt)}
                          {p.invoice?.invoiceNumber ? ` · ${p.invoice.invoiceNumber}` : ""}
                        </span>
                        <span className="font-medium">{formatINR(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/client-payments?clientId=${clientId}`}
                  className="text-sm text-primary hover:underline mt-2 inline-block"
                >
                  View all payments →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
