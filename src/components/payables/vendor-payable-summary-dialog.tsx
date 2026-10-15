"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import { formatINR, formatDate } from "@/lib/utils";
import type { VendorPayableSummary } from "@/lib/services/payables.service";

export default function VendorPayableSummaryDialog({
  vendorId,
  vendorName,
  open,
  onClose,
}: {
  vendorId: string;
  vendorName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<VendorPayableSummary | null>(null);

  useEffect(() => {
    if (!open || !vendorId) return;
    setLoading(true);
    setError("");
    fetch(`/api/payables/vendor/${vendorId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load vendor summary");
        }
        return res.json();
      })
      .then((data) => setSummary(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, vendorId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">{vendorName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{summary?.ageingLabel}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>

        <div className="p-4 space-y-6">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {summary && !loading && (
            <>
              <div>
                <h3 className="font-medium mb-2">Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Gross freight</p>
                    <p className="font-semibold">{formatINR(summary.grossFreightPayable)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Additional charges</p>
                    <p className="font-semibold">{formatINR(summary.additionalCharges)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Deductions</p>
                    <p className="font-semibold text-red-600">−{formatINR(summary.deductions)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">TDS withheld</p>
                    <p className="font-semibold text-muted-foreground">{formatINR(summary.tds)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Advances paid</p>
                    <p className="font-semibold text-green-700">{formatINR(summary.advancesPaid)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Balance paid</p>
                    <p className="font-semibold text-green-700">{formatINR(summary.balancePaid)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Total paid</p>
                    <p className="font-semibold text-green-700">{formatINR(summary.totalPaid)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Outstanding (net cash)</p>
                    <p className="font-semibold">{formatINR(summary.outstanding)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Trip breakdown</h3>
                {summary.trips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outstanding trip payables.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-2">Trip/LR</th>
                          <th className="py-2 pr-2">Client</th>
                          <th className="py-2 pr-2 text-right">Freight</th>
                          <th className="py-2 pr-2 text-right">Addl.</th>
                          <th className="py-2 pr-2 text-right">Ded.</th>
                          <th className="py-2 pr-2 text-right">Gross</th>
                          <th className="py-2 pr-2 text-right">TDS</th>
                          <th className="py-2 pr-2 text-right">Advance</th>
                          <th className="py-2 pr-2 text-right">Final</th>
                          <th className="py-2 pr-2 text-right">Paid</th>
                          <th className="py-2 pr-2 text-right">Out.</th>
                          <th className="py-2 pr-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.trips.map((trip) => (
                          <tr key={trip.tripId} className="border-b">
                            <td className="py-2 pr-2">
                              <Link href={`/trips/${trip.tripId}`} className="text-primary hover:underline">
                                {trip.lrNumber}
                              </Link>
                            </td>
                            <td className="py-2 pr-2">{trip.clientName}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(trip.freight)}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(trip.additionalCharges)}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(trip.deductions)}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(trip.grossPayable)}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(trip.tds)}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(trip.advance)}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(trip.finalPayable)}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(trip.paid)}</td>
                            <td className="py-2 pr-2 text-right font-medium">{formatINR(trip.outstanding)}</td>
                            <td className="py-2 pr-2">
                              <StatusBadge status={trip.paymentStatus} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium mb-2">Payment history</h3>
                {summary.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vendor payments recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-2">Date</th>
                          <th className="py-2 pr-2">Trip/LR</th>
                          <th className="py-2 pr-2">Type</th>
                          <th className="py-2 pr-2 text-right">Amount</th>
                          <th className="py-2 pr-2 text-right">TDS</th>
                          <th className="py-2 pr-2 text-right">Net paid</th>
                          <th className="py-2 pr-2">Mode</th>
                          <th className="py-2 pr-2">Reference</th>
                          <th className="py-2 pr-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.payments.slice(0, 20).map((p) => (
                          <tr key={p.id} className="border-b">
                            <td className="py-2 pr-2">{p.paidAt ? formatDate(p.paidAt) : "—"}</td>
                            <td className="py-2 pr-2">
                              {p.trip ? (
                                <Link href={`/trips/${p.tripId}`} className="text-primary hover:underline">
                                  {p.trip.lrNumber}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2 pr-2">{p.paymentType}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(p.amount)}</td>
                            <td className="py-2 pr-2 text-right">{formatINR(p.tdsAmount)}</td>
                            <td className="py-2 pr-2 text-right font-medium">{formatINR(p.netPayable)}</td>
                            <td className="py-2 pr-2">{p.paymentMode ?? "—"}</td>
                            <td className="py-2 pr-2">{p.referenceNo ?? p.chequeNumber ?? "—"}</td>
                            <td className="py-2 pr-2">
                              <StatusBadge status={p.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Link
                  href={`/payments?vendorId=${vendorId}`}
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
