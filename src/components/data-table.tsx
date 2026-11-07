"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  /** When true, prefer this column on mobile cards. */
  mobile?: boolean;
};

type Row = Record<string, unknown> & { id?: string };

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const PAGE_SIZE_STORAGE_KEY = "tms.list.pageSize";

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

function isValidPageSize(n: number): n is (typeof PAGE_SIZE_OPTIONS)[number] {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n);
}

function readStoredPageSize(fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    if (isValidPageSize(raw)) return raw;
  } catch {
    /* ignore */
  }
  return isValidPageSize(fallback) ? fallback : 10;
}

function writeStoredPageSize(n: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function mobileColumnsFor(columns: DataColumn[]): DataColumn[] {
  const explicit = columns.filter((c) => c.mobile);
  if (explicit.length > 0) return explicit.slice(0, 5);
  const preferred = columns.filter(
    (c) =>
      c.kind === "badge" ||
      c.kind === "link" ||
      /status/i.test(c.key) ||
      /status/i.test(c.header)
  );
  const rest = columns.filter((c) => !preferred.includes(c));
  return [...preferred, ...rest].slice(0, 4);
}

function renderCellContent(
  c: DataColumn,
  r: Row,
  opts: { isFirst: boolean; rowHrefPrefix?: string; onRowClick?: (row: Row) => void }
): ReactNode {
  const raw = r[c.key];
  let content: ReactNode = cellValue(c, r);
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
  } else if (opts.rowHrefPrefix && opts.isFirst) {
    const id = String(r.id ?? "");
    content = (
      <Link href={`${opts.rowHrefPrefix}${id}`} className="font-semibold text-primary hover:underline">
        {cellValue(c, r)}
      </Link>
    );
  }
  return content;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlPageSizeRaw = Number(searchParams.get("pageSize"));
  const urlPageRaw = Number(searchParams.get("page"));
  const initialPage = Number.isFinite(urlPageRaw) && urlPageRaw >= 1 ? Math.floor(urlPageRaw) : 1;
  const ssrSafeSize = isValidPageSize(urlPageSizeRaw)
    ? urlPageSizeRaw
    : isValidPageSize(pageSize)
      ? pageSize
      : 10;

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(initialPage);
  const [size, setSize] = useState<number>(ssrSafeSize);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [colsOpen, setColsOpen] = useState(false);

  const syncUrl = useCallback(
    (nextPage: number, nextSize: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextPage <= 1) params.delete("page");
      else params.set("page", String(nextPage));
      params.set("pageSize", String(nextSize));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Prefer URL pageSize; otherwise restore last choice from localStorage and seed the URL.
  useEffect(() => {
    const ps = Number(searchParams.get("pageSize"));
    if (isValidPageSize(ps)) {
      if (ps !== size) setSize(ps);
      return;
    }
    const stored = readStoredPageSize(ssrSafeSize);
    if (stored !== size) setSize(stored);
    syncUrl(page, stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + URL pageSize only
  }, [searchParams]);

  // Keep page aligned when URL changes (browser back/forward).
  useEffect(() => {
    const p = Number(searchParams.get("page"));
    if (Number.isFinite(p) && p >= 1 && Math.floor(p) !== page) setPage(Math.floor(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL only
  }, [searchParams]);

  const visibleCols = columns.filter((c) => !hidden[c.key]);
  const mobileCols = useMemo(() => mobileColumnsFor(visibleCols), [visibleCols]);

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

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
      syncUrl(totalPages, size);
    }
  }, [page, totalPages, size, syncUrl]);

  function setPageAndUrl(next: number) {
    setPage(next);
    syncUrl(next, size);
  }

  function setSizeAndUrl(next: number) {
    const n = isValidPageSize(next) ? next : 10;
    writeStoredPageSize(n);
    setSize(n);
    setPage(1);
    syncUrl(1, n);
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportCsv() {
    const cols = visibleCols.map((c) => ({ key: c.key, header: c.header }));
    const exportRows = sorted.map((r) => {
      const row: Record<string, unknown> = {};
      for (const c of visibleCols) row[c.key] = cellValue(c, r);
      return row;
    });
    downloadExcelCsv(exportName ?? "export", cols, exportRows);
  }

  const rowOpts = { rowHrefPrefix, onRowClick };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full flex-1 sm:min-w-[220px]">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPageAndUrl(1);
            }}
            placeholder="Search records…"
            className="h-11 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setColsOpen((v) => !v)}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-muted sm:px-4"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Table options</span>
            </button>
            {colsOpen && (
              <div
                className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg"
                onMouseLeave={() => setColsOpen(false)}
              >
                {columns.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  >
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
            className="hidden h-11 items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-muted sm:inline-flex"
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {paged.length === 0 && (
          <div className="rounded-xl border border-border px-4 py-10 text-center text-muted-foreground">
            {emptyText}
          </div>
        )}
        {paged.map((r, i) => {
          const titleCol = mobileCols[0] ?? visibleCols[0];
          const rest = mobileCols.slice(1);
          return (
            <div
              key={(r.id as string) ?? i}
              className={cn(
                "rounded-xl border border-border bg-card p-4 shadow-sm",
                onRowClick && "cursor-pointer active:bg-muted/40"
              )}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {titleCol && (
                <div className="mb-2 text-base font-semibold text-foreground">
                  {renderCellContent(titleCol, r, { ...rowOpts, isFirst: true })}
                </div>
              )}
              <dl className="grid grid-cols-1 gap-2 text-sm">
                {rest.map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">{c.header}</dt>
                    <dd className={cn("min-w-0 text-right text-card-foreground", c.align === "right" && "font-medium")}>
                      {renderCellContent(c, r, { ...rowOpts, isFirst: false })}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto overscroll-x-contain rounded-xl border border-border md:block">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
              {visibleCols.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-4 py-3.5 text-sm font-semibold",
                    c.align === "right" && "text-right"
                  )}
                >
                  <button
                    onClick={() => toggleSort(c.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 hover:text-foreground",
                      c.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {c.header}
                    <ArrowUpDown
                      className={cn("h-3.5 w-3.5", sortKey === c.key ? "text-foreground" : "opacity-40")}
                    />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length} className="px-4 py-14 text-center text-base text-muted-foreground">
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
                {visibleCols.map((c) => (
                  <td
                    key={c.key}
                    className={cn("px-4 py-4 text-card-foreground", c.align === "right" && "text-right")}
                  >
                    {renderCellContent(c, r, {
                      ...rowOpts,
                      isFirst: visibleCols[0]?.key === c.key,
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="text-base">{sorted.length} record(s)</span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={size}
            onChange={(e) => setSizeAndUrl(Number(e.target.value))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
          <button
            onClick={() => setPageAndUrl(Math.max(1, current - 1))}
            disabled={current <= 1}
            className="h-10 rounded-lg border border-input px-4 font-medium hover:bg-muted disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 font-medium text-foreground">
            {current} / {totalPages}
          </span>
          <button
            onClick={() => setPageAndUrl(Math.min(totalPages, current + 1))}
            disabled={current >= totalPages}
            className="h-10 rounded-lg border border-input px-4 font-medium hover:bg-muted disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
