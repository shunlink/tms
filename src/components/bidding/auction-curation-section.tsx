"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import {
  type CurationSort,
  formatBiddingProxyError,
  loadCurationCandidates,
  submitAuctionCuration,
} from "@/lib/bidding/admin-api";
import { useToast } from "@/components/toast";

export type CurationCandidate = {
  vendorCompanyId: string;
  vendorName: string;
  vendorPrice: number;
};

type ShortlistRow = {
  vendorCompanyId: string;
  vendorName: string;
  vendorPrice: number;
  clientPrice: string;
};

function extractCandidates(data: unknown): CurationCandidate[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const arr =
    (Array.isArray(o.candidates) ? o.candidates : null) ??
    (Array.isArray(o.items) ? o.items : null) ??
    (Array.isArray(o.data) ? o.data : null) ??
    (Array.isArray(data) ? data : null);
  if (!arr) return [];

  const out: CurationCandidate[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const vendorCompanyId = String(r.vendorCompanyId ?? r.companyId ?? r.id ?? "").trim();
    if (!vendorCompanyId) continue;
    const vendorName = String(
      r.vendorName ?? r.companyName ?? r.displayName ?? r.name ?? vendorCompanyId
    );
    const vendorPrice = Number(
      r.vendorPrice ?? r.bidAmount ?? r.amount ?? r.lowestBid ?? r.price ?? NaN
    );
    if (Number.isNaN(vendorPrice)) continue;
    out.push({ vendorCompanyId, vendorName, vendorPrice });
  }
  return out;
}

const MAX_SHORTLIST = 5;

export default function AuctionCurationSection({
  auctionId,
  onCurated,
}: {
  auctionId: string;
  onCurated: () => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<CurationSort>("lowest_bid");
  const [candidates, setCandidates] = useState<CurationCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shortlist, setShortlist] = useState<ShortlistRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { ok, data, status } = await loadCurationCandidates(auctionId, q, sort);
    setLoading(false);
    if (!ok) {
      setCandidates([]);
      setError(formatBiddingProxyError(status, data, "Could not load curation candidates"));
      return;
    }
    setCandidates(extractCandidates(data));
  }, [auctionId, q, sort]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      load();
    }, 300);
    return () => window.clearTimeout(t);
  }, [load]);

  const suggestions = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => a.vendorPrice - b.vendorPrice);
    return sorted.slice(0, 5);
  }, [candidates]);

  function isShortlisted(vendorCompanyId: string) {
    return shortlist.some((s) => s.vendorCompanyId === vendorCompanyId);
  }

  function addToShortlist(c: CurationCandidate) {
    if (isShortlisted(c.vendorCompanyId)) return;
    if (shortlist.length >= MAX_SHORTLIST) {
      setError(`Shortlist is limited to ${MAX_SHORTLIST} vendors`);
      return;
    }
    setError("");
    setShortlist((prev) => [
      ...prev,
      {
        vendorCompanyId: c.vendorCompanyId,
        vendorName: c.vendorName,
        vendorPrice: c.vendorPrice,
        clientPrice: String(c.vendorPrice),
      },
    ]);
  }

  function removeFromShortlist(vendorCompanyId: string) {
    setShortlist((prev) => prev.filter((s) => s.vendorCompanyId !== vendorCompanyId));
  }

  async function submitCurate() {
    if (!shortlist.length) {
      setError("Add at least one vendor to the shortlist");
      return;
    }
    const quotes = shortlist.map((s) => ({
      vendorCompanyId: s.vendorCompanyId,
      vendorPrice: s.vendorPrice,
      clientPrice: Number(s.clientPrice),
    }));
    if (quotes.some((q) => Number.isNaN(q.clientPrice) || q.clientPrice <= 0)) {
      setError("Enter a valid client price for each shortlisted vendor");
      return;
    }
    setBusy(true);
    setError("");
    const { ok, data, status } = await submitAuctionCuration(auctionId, quotes);
    setBusy(false);
    if (!ok) {
      const message = formatBiddingProxyError(status, data, "Curate failed");
      setError(message);
      toast.push({ title: message, variant: "error" });
      return;
    }
    toast.push({ title: "Curated quotes submitted", variant: "success" });
    onCurated();
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Curate quotes for client</h3>
        <p className="text-xs text-slate-600 mt-1">
          Rankings use each vendor&apos;s final bid at auction close (not their historical low). Pick up to{" "}
          {MAX_SHORTLIST} vendors, set client price, then submit.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-[200px] rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search vendors…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as CurationSort)}
        >
          <option value="lowest_bid">Lowest bid</option>
          <option value="latest_bid">Latest bid</option>
          <option value="name_asc">Name A–Z</option>
        </select>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-700 mb-2">Suggested (lowest 5)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.map((c) => (
              <button
                key={c.vendorCompanyId}
                type="button"
                disabled={isShortlisted(c.vendorCompanyId) || shortlist.length >= MAX_SHORTLIST}
                onClick={() => addToShortlist(c)}
                className="text-left rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400 disabled:opacity-50"
              >
                <p className="font-medium text-sm text-slate-900 truncate">{c.vendorName}</p>
                <p className="text-xs text-slate-500 font-mono">{c.vendorCompanyId}</p>
                <p className="text-sm text-emerald-800 mt-1">{formatINR(c.vendorPrice)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b px-3 py-2 text-xs font-medium text-slate-600">All candidates</div>
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading…</p>
        ) : candidates.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No candidates found.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2 text-right">Bid</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.vendorCompanyId} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.vendorName}</div>
                      <div className="text-xs text-slate-500 font-mono">{c.vendorCompanyId}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatINR(c.vendorPrice)}</td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isShortlisted(c.vendorCompanyId) || shortlist.length >= MAX_SHORTLIST}
                        onClick={() => addToShortlist(c)}
                      >
                        Add
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {shortlist.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">Shortlist ({shortlist.length}/{MAX_SHORTLIST})</p>
          {shortlist.map((s) => (
            <div
              key={s.vendorCompanyId}
              className="grid gap-2 rounded border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <p className="font-medium text-sm">{s.vendorName}</p>
                <p className="text-xs text-slate-500">Vendor: {formatINR(s.vendorPrice)}</p>
              </div>
              <input
                type="number"
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Client price"
                value={s.clientPrice}
                onChange={(e) =>
                  setShortlist((prev) =>
                    prev.map((row) =>
                      row.vendorCompanyId === s.vendorCompanyId
                        ? { ...row, clientPrice: e.target.value }
                        : row
                    )
                  )
                }
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeFromShortlist(s.vendorCompanyId)}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" className="w-full" disabled={busy} onClick={submitCurate}>
            Submit curated quotes
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
    </div>
  );
}
