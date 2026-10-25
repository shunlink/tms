"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import ReallocateVendorDialog from "@/components/forms/reallocate-vendor-dialog";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type Quote = {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string | null;
  vendorRating: number | null;
  vehicleNumber: string | null;
  quotedRate: number;
  channel: string;
  remarks: string | null;
  submittedAt: string;
};

type VendorOption = { id: string; name: string };

export default function IndentQuotes({
  indentId,
  canAllocate,
  initialQuotes = [],
  allocatedVendorId,
  allocatedVendorName,
  canReallocate = false,
  vendors = [],
}: {
  indentId: string;
  canAllocate: boolean;
  initialQuotes?: Quote[];
  allocatedVendorId?: string | null;
  allocatedVendorName?: string | null;
  canReallocate?: boolean;
  vendors?: VendorOption[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [loading, setLoading] = useState(initialQuotes.length === 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reallocateOpen, setReallocateOpen] = useState(false);

  useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);

  useEffect(() => {
    fetch(`/api/indents/${indentId}/quotes`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          setError(data?.error || "Could not load quotes");
          return;
        }
        setQuotes(Array.isArray(data) ? data : []);
      })
      .catch(() => setError("Could not load quotes"))
      .finally(() => setLoading(false));
  }, [indentId]);

  async function acceptQuote(quoteId: string) {
    setError("");
    setBusy(quoteId);
    const res = await fetch(`/api/indents/${indentId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId }),
    });
    setBusy(null);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to allocate vendor" });
      return;
    }
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading vendor quotes...</p>;
  }

  if (quotes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No vendor quotes yet. Vendors can submit quotes from their portal.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-4">Vendor</th>
              <th className="py-2 pr-4">Rate</th>
              <th className="py-2 pr-4">Vehicle</th>
              <th className="py-2 pr-4">Channel</th>
              <th className="py-2 pr-4">Submitted</th>
              {canAllocate && <th className="py-2">Action</th>}
            </tr>
          </thead>
          <tbody>
            {quotes.map((q, idx) => {
              const isAllocated = allocatedVendorId === q.vendorId;
              return (
                <tr key={q.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-slate-900">
                      #{idx + 1} {q.vendorName}
                    </div>
                    {q.vendorRating != null && (
                      <div className="text-xs text-slate-500">{q.vendorRating}★</div>
                    )}
                    {isAllocated && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        ALLOCATED
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-semibold text-green-700">
                    {formatINR(q.quotedRate)}
                  </td>
                  <td className="py-3 pr-4">{q.vehicleNumber ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">
                      {q.channel}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {new Date(q.submittedAt).toLocaleString("en-IN")}
                  </td>
                  {canAllocate && (
                    <td className="py-3">
                      {isAllocated ? (
                        canReallocate ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReallocateOpen(true)}
                          >
                            Reallocate
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">Current vendor</span>
                        )
                      ) : !allocatedVendorId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === q.id}
                          onClick={() => acceptQuote(q.id)}
                        >
                          {busy === q.id ? "..." : "Allocate"}
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canReallocate && allocatedVendorName && (
        <ReallocateVendorDialog
          indentId={indentId}
          currentVendorName={allocatedVendorName}
          vendors={vendors.filter((v) => v.id !== allocatedVendorId)}
          open={reallocateOpen}
          onClose={() => setReallocateOpen(false)}
        />
      )}
    </div>
  );
}
