"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Eye, History, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import ClientReceivableSummaryDialog from "@/components/receivables/client-receivable-summary-dialog";
import { formatINR, formatDate } from "@/lib/utils";
import type { PaginatedResult } from "@/lib/pagination";
import type { ReceivableRow, ReceivablesSortField } from "@/lib/services/receivables.service";

const SORT_FIELDS: { key: ReceivablesSortField; label: string }[] = [
  { key: "dueDate", label: "Due date" },
  { key: "outstanding", label: "Outstanding" },
  { key: "issueDate", label: "Invoice date" },
  { key: "client", label: "Client" },
];

export default function ReceivablesTable({
  data,
}: {
  data: PaginatedResult<ReceivableRow>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clientDialog, setClientDialog] = useState<{ id: string; name: string } | null>(null);

  const currentSort = (searchParams.get("sort") as ReceivablesSortField) || "dueDate";
  const currentDir = searchParams.get("dir") === "desc" ? "desc" : "asc";

  function setSort(field: ReceivablesSortField) {
    const params = new URLSearchParams(searchParams.toString());
    const nextDir = currentSort === field && currentDir === "asc" ? "desc" : "asc";
    params.set("sort", field);
    params.set("dir", field === "dueDate" && currentSort !== field ? "asc" : nextDir);
    router.push(`/receivables?${params.toString()}`);
  }

  const pageSizeOptions = [10, 25, 50, 100] as const;
  const urlPageSize = Number(searchParams.get("pageSize"));
  const currentPageSize = pageSizeOptions.includes(urlPageSize as (typeof pageSizeOptions)[number])
    ? urlPageSize
    : data.pageSize;

  useEffect(() => {
    if (searchParams.get("pageSize")) return;
    try {
      const stored = Number(window.localStorage.getItem("tms.list.pageSize"));
      if (!pageSizeOptions.includes(stored as (typeof pageSizeOptions)[number])) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("pageSize", String(stored));
      router.replace(`/receivables?${params.toString()}`);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once from storage when URL lacks pageSize
  }, []);

  function setPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`/receivables?${params.toString()}`);
  }

  function setPageSize(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", String(next));
    params.set("page", "1");
    try {
      window.localStorage.setItem("tms.list.pageSize", String(next));
    } catch {
      /* ignore */
    }
    router.push(`/receivables?${params.toString()}`);
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Invoice</th>
              <th className="py-2 pr-3 font-medium">
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort("issueDate")}>
                  Invoice date <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="py-2 pr-3 font-medium">
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort("dueDate")}>
                  Due date <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="py-2 pr-3 font-medium">
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort("client")}>
                  Client <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="py-2 pr-3 font-medium">Trip/LR</th>
              <th className="py-2 pr-3 font-medium text-right">Invoice</th>
              <th className="py-2 pr-3 font-medium text-right">Paid</th>
              <th className="py-2 pr-3 font-medium text-right">
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => setSort("outstanding")}>
                  Outstanding <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="py-2 pr-3 font-medium text-right">Days overdue</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-muted-foreground">
                  No outstanding receivables match your filters.
                </td>
              </tr>
            )}
            {data.items.map((row) => (
              <tr key={row.id} className="border-b hover:bg-muted/40">
                <td className="py-2.5 pr-3">
                  <Link href={`/invoices/${row.id}`} className="font-medium text-primary hover:underline">
                    {row.invoiceNumber}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">{formatDate(row.issueDate)}</td>
                <td className="py-2.5 pr-3">{row.dueDate ? formatDate(row.dueDate) : "—"}</td>
                <td className="py-2.5 pr-3">
                  <button
                    type="button"
                    className="text-primary hover:underline text-left"
                    onClick={() => setClientDialog({ id: row.clientId, name: row.clientName })}
                  >
                    {row.clientName}
                  </button>
                </td>
                <td className="py-2.5 pr-3">{row.tripLr}</td>
                <td className="py-2.5 pr-3 text-right">{formatINR(row.totalAmount)}</td>
                <td className="py-2.5 pr-3 text-right">{formatINR(row.paidAmount)}</td>
                <td className="py-2.5 pr-3 text-right font-medium">{formatINR(row.outstanding)}</td>
                <td className="py-2.5 pr-3 text-right">
                  {row.daysOverdue > 0 ? (
                    <span className="text-red-600 font-medium">{row.daysOverdue}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  <StatusBadge status={row.displayStatus} />
                </td>
                <td className="py-2.5">
                  <div className="flex flex-wrap gap-1">
                    <Link href={`/invoices/${row.id}`}>
                      <Button variant="outline" size="sm" title="View invoice">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Link
                      href={`/client-payments?invoiceId=${row.id}&clientId=${row.clientId}&amount=${row.outstanding}`}
                    >
                      <Button variant="outline" size="sm" title="Record payment">
                        <Receipt className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Link href={`/client-payments?invoiceId=${row.id}`}>
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Page {data.page} of {Math.max(1, data.totalPages)} · {data.total} invoices
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentPageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
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

      {clientDialog && (
        <ClientReceivableSummaryDialog
          clientId={clientDialog.id}
          clientName={clientDialog.name}
          open={Boolean(clientDialog)}
          onClose={() => setClientDialog(null)}
        />
      )}
    </>
  );
}
