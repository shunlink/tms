"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, CreditCard, Eye, History, IndianRupee, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import VendorPayableSummaryDialog from "@/components/payables/vendor-payable-summary-dialog";
import { formatINR, formatDate } from "@/lib/utils";
import type { PaginatedResult } from "@/lib/pagination";
import type { PayableVendorRow, PayablesSortField } from "@/lib/services/payables.service";

const SORT_FIELDS: { key: PayablesSortField; label: string }[] = [
  { key: "outstanding", label: "Outstanding" },
  { key: "oldestDue", label: "Oldest due" },
  { key: "vendor", label: "Vendor" },
];

export default function PayablesTable({
  data,
  ageingLabel,
}: {
  data: PaginatedResult<PayableVendorRow>;
  ageingLabel: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vendorDialog, setVendorDialog] = useState<{ id: string; name: string } | null>(null);

  const currentSort = (searchParams.get("sort") as PayablesSortField) || "outstanding";
  const currentDir = searchParams.get("dir") === "asc" ? "asc" : "desc";

  function setSort(field: PayablesSortField) {
    const params = new URLSearchParams(searchParams.toString());
    const nextDir = currentSort === field && currentDir === "desc" ? "asc" : "desc";
    params.set("sort", field);
    params.set("dir", field === "outstanding" && currentSort !== field ? "desc" : nextDir);
    router.push(`/payables?${params.toString()}`);
  }

  function setPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`/payables?${params.toString()}`);
  }

  return (
    <>
      <p className="text-xs text-muted-foreground mb-3">
        Commercial ageing: {ageingLabel}. Payment SLA deadlines are shown separately where applicable.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort("vendor")}>
                  Vendor <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="py-2 pr-3 font-medium text-right">Trips</th>
              <th className="py-2 pr-3 font-medium text-right">Gross payable</th>
              <th className="py-2 pr-3 font-medium text-right">Advance paid</th>
              <th className="py-2 pr-3 font-medium text-right">Advance out.</th>
              <th className="py-2 pr-3 font-medium text-right">Balance payable</th>
              <th className="py-2 pr-3 font-medium text-right">TDS</th>
              <th className="py-2 pr-3 font-medium text-right">
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => setSort("outstanding")}>
                  Net outstanding <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="py-2 pr-3 font-medium">
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort("oldestDue")}>
                  Oldest due <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-muted-foreground">
                  No outstanding vendor payables match your filters.
                </td>
              </tr>
            )}
            {data.items.map((row) => (
              <tr key={row.vendorId} className="border-b hover:bg-muted/40">
                <td className="py-2.5 pr-3">
                  <button
                    type="button"
                    className="text-primary hover:underline text-left font-medium"
                    onClick={() => setVendorDialog({ id: row.vendorId, name: row.vendorName })}
                  >
                    {row.vendorName}
                  </button>
                </td>
                <td className="py-2.5 pr-3 text-right">{row.tripCount}</td>
                <td className="py-2.5 pr-3 text-right">{formatINR(row.grossPayable)}</td>
                <td className="py-2.5 pr-3 text-right">{formatINR(row.advancePaid)}</td>
                <td className="py-2.5 pr-3 text-right">{formatINR(row.advanceOutstanding)}</td>
                <td className="py-2.5 pr-3 text-right">{formatINR(row.balancePayable)}</td>
                <td className="py-2.5 pr-3 text-right text-muted-foreground">{formatINR(row.tds)}</td>
                <td className="py-2.5 pr-3 text-right font-semibold">{formatINR(row.netOutstanding)}</td>
                <td className="py-2.5 pr-3">
                  {row.oldestDue ? (
                    <span title={row.slaDeadline ? `Payment SLA: ${formatDate(row.slaDeadline)}` : undefined}>
                      {formatDate(row.oldestDue)}
                      {row.ageingDays > 0 && (
                        <span className="block text-xs text-muted-foreground">{row.ageingDays}d aged</span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  <StatusBadge status={row.displayStatus} />
                </td>
                <td className="py-2.5">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      title="View vendor summary"
                      onClick={() => setVendorDialog({ id: row.vendorId, name: row.vendorName })}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Link href={`/vendors/${row.vendorId}`}>
                      <Button variant="outline" size="sm" title="View vendor">
                        <IndianRupee className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    {row.hasAdvance && (
                      <Link href={`/advance-payments?vendorId=${row.vendorId}`}>
                        <Button variant="outline" size="sm" title="View advances">
                          <CreditCard className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                    {row.hasBalanceTask && (
                      <Link href={`/balance-payments?vendorId=${row.vendorId}`}>
                        <Button variant="outline" size="sm" title="View balance payments">
                          <Route className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                    <Link href={`/payments?vendorId=${row.vendorId}`}>
                      <Button variant="outline" size="sm" title="Payment history">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground">
            Page {data.page} of {data.totalPages} · {data.total} vendors
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage(data.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage(data.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {vendorDialog && (
        <VendorPayableSummaryDialog
          vendorId={vendorDialog.id}
          vendorName={vendorDialog.name}
          open={Boolean(vendorDialog)}
          onClose={() => setVendorDialog(null)}
        />
      )}
    </>
  );
}
