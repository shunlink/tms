"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Download, Search, SlidersHorizontal } from "lucide-react";
import { cn, formatINR, formatDate } from "@/lib/utils";
import { downloadExcelCsv } from "@/lib/table-export";

export type DataColumn = {
  key: string;
  header: string;
  align?: "left" | "right";
  kind?: "text" | "money" | "date" | "link" | "external-link" | "badge";
  hrefPrefix?: string;
  idKey?: string;
  /** Row field containing a full URL — used with kind `external-link`. */
  hrefKey?: string;
  tones?: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default">;
  labels?: Record<string, string>;
};

type Row = Record<string, unknown> & { id?: string };

const toneClass: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
  muted: "bg-muted text-muted-foreground",
  default: "bg-primary/10 text-primary",
};

function cellValue(col: DataColumn, row: Row) {
  const raw = row[col.key];
  if (raw == null || raw === "") return "—";
  if (col.kind === "money") return formatINR(Number(raw));
  if (col.kind === "date") return formatDate(raw as string);
  if (col.kind === "badge") return col.labels?.[String(raw)] ?? String(raw);
  return String(raw);
}

export default function DataTable({
  rows,
  columns,
  searchKeys,
  pageSize = 10,
  exportName,
  emptyText = "No records found.",
  rowHrefPrefix,
  onRowClick,
}: {
  rows: Row[];
  columns: DataColumn[];
  searchKeys?: string[];
  pageSize?: number;
  exportName?: string;
  emptyText?: string;
  rowHrefPrefix?: string;
  onRowClick?: (row: Row) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [colsOpen, setColsOpen] = useState(false);

  const visibleCols = columns.filter((c) => !hidden[c.key]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const keys = searchKeys ?? columns.map((c) => c.key);
    return rows.filter((r) => keys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
  }, [rows, query, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = Number(av);
      const bn = Number(bv);
      let cmp: number;
      if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== "" && bv !== "") cmp = an - bn;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / size));
  const current = Math.min(page, totalPages);
  const paged = sorted.slice((current - 1) * size, current * size);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportCsv() {
    const columns = visibleCols.map((c) => ({ key: c.key, header: c.header }));
    const rows = sorted.map((r) => {
      const row: Record<string, unknown> = {};
      for (const c of visibleCols) row[c.key] = cellValue(c, r);
      return row;
    });
    downloadExcelCsv(exportName ?? "export", columns, rows);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search records…"
            className="h-11 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setColsOpen((v) => !v)}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            <SlidersHorizontal className="h-4 w-4" /> Table options
          </button>
          {colsOpen && (
            <div
              className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg"
              onMouseLeave={() => setColsOpen(false)}
            >
              {columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hidden[c.key]}
                    onChange={() => setHidden((h) => ({ ...h, [c.key]: !h[c.key] }))}
                  />
                  {c.header}
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={exportCsv}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          <Download className="h-4 w-4" /> Export Excel
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
              {visibleCols.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3.5 text-sm font-semibold whitespace-nowrap",
                    c.align === "right" && "text-right"
                  )}
                >
                  <button
                    onClick={() => toggleSort(c.key)}
                    className={cn("inline-flex items-center gap-1.5 hover:text-foreground", c.align === "right" && "flex-row-reverse")}
                  >
                    {c.header}
                    <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === c.key ? "text-foreground" : "opacity-40")} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length} className="px-4 py-14 text-center text-muted-foreground text-base">
                  {emptyText}
                </td>
              </tr>
            )}
            {paged.map((r, i) => (
              <tr
                key={(r.id as string) ?? i}
                className={cn(
                  "border-b border-border last:border-0 hover:bg-muted/40",
                  onRowClick && "cursor-pointer"
                )}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
              >
                {visibleCols.map((c) => {
                  const raw = r[c.key];
                  const isFirst = visibleCols[0]?.key === c.key;
                  let content: React.ReactNode = cellValue(c, r);
                  if (c.kind === "external-link" && c.hrefKey) {
                    const href = r[c.hrefKey];
                    if (href) {
                      content = (
                        <a
                          href={String(href)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {cellValue(c, r)}
                        </a>
                      );
                    }
                  } else if (c.kind === "link" && c.hrefPrefix) {
                    const id = String(r[c.idKey ?? "id"] ?? "");
                    if (id && id !== "—") {
                      content = (
                        <Link
                          href={`${c.hrefPrefix}${id}`}
                          className="font-semibold text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {cellValue(c, r)}
                        </Link>
                      );
                    }
                  } else if (c.kind === "badge") {
                    const tone = c.tones?.[String(raw)] ?? "muted";
                    content = (
                      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClass[tone])}>
                        {cellValue(c, r)}
                      </span>
                    );
                  } else if (rowHrefPrefix && isFirst) {
                    const id = String(r.id ?? "");
                    content = (
                      <Link href={`${rowHrefPrefix}${id}`} className="font-semibold text-primary hover:underline">
                        {cellValue(c, r)}
                      </Link>
                    );
                  }
                  return (
                    <td
                      key={c.key}
                      className={cn("px-4 py-4 text-card-foreground", c.align === "right" && "text-right")}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-muted-foreground">
        <span className="text-base">{sorted.length} record(s)</span>
        <div className="flex items-center gap-2">
          <select
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={current <= 1}
            className="h-10 rounded-lg border border-input px-4 disabled:opacity-40 hover:bg-muted font-medium"
          >
            Previous
          </button>
          <span className="px-2 font-medium text-foreground">
            {current} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={current >= totalPages}
            className="h-10 rounded-lg border border-input px-4 disabled:opacity-40 hover:bg-muted font-medium"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
