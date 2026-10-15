"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CityOption = { city: string; vendorCount: number };

export default function ReleaseVendorsDialog({
  indentId,
  indentNumber,
  open,
  onClose,
  canRelease,
}: {
  indentId: string;
  indentNumber: string;
  open: boolean;
  onClose: () => void;
  canRelease: boolean;
}) {
  const router = useRouter();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [releasedCities, setReleasedCities] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSearch("");
    setLoading(true);
    fetch(`/api/vendors/release-cities?indentId=${encodeURIComponent(indentId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to load vendor cities");
        }
        setCities(data.cities ?? []);
        setReleasedCities(data.releasedCities ?? []);
        setSelected(new Set());
      })
      .catch((err: unknown) => {
        setCities([]);
        setReleasedCities([]);
        setError(err instanceof Error ? err.message : "Failed to load vendor cities");
      })
      .finally(() => setLoading(false));
  }, [open, indentId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.city.toLowerCase().includes(q));
  }, [cities, search]);

  const selectedSummary = useMemo(() => {
    const rows = cities.filter((c) => selected.has(c.city));
    const total = rows.reduce((sum, c) => sum + c.vendorCount, 0);
    return { rows, total, count: rows.length };
  }, [cities, selected]);

  function toggleCity(city: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  async function confirmRelease() {
    if (selected.size === 0) {
      setError("Select at least one vendor city");
      return;
    }
    setError("");
    setBusy(true);
    const res = await fetch(`/api/indents/${indentId}/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", cities: Array.from(selected) }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Release failed");
      return;
    }
    onClose();
    router.refresh();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border bg-white shadow-xl"
        role="dialog"
        aria-labelledby="release-dialog-title"
      >
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h2 id="release-dialog-title" className="text-lg font-semibold text-slate-900">
              Release to Vendors
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{indentNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {releasedCities.length > 0 && (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
              Previously released to: {releasedCities.join(", ")}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select vendor cities
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 py-4 text-center">Loading cities...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              {cities.length === 0 ? "No registered vendor cities found." : "No cities match your search."}
            </p>
          ) : (
            <ul className="space-y-1 rounded-lg border divide-y max-h-56 overflow-y-auto">
              {filtered.map((row) => {
                const checked = selected.has(row.city);
                return (
                  <li key={row.city}>
                    <label
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 ${
                        checked ? "bg-blue-50/60" : ""
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={checked}
                          onChange={() => toggleCity(row.city)}
                        />
                        <span className="text-sm font-medium text-slate-900 truncate">{row.city}</span>
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">
                        {row.vendorCount} vendor{row.vendorCount === 1 ? "" : "s"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedSummary.count > 0 && (
            <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2 text-sm">
              <p className="font-medium text-slate-900">
                {selectedSummary.count} city{selectedSummary.count === 1 ? "" : "ies"} selected ·{" "}
                {selectedSummary.total} vendor{selectedSummary.total === 1 ? "" : "s"} will receive this indent
              </p>
              <div className="text-slate-600 space-y-0.5">
                {selectedSummary.rows.map((row) => (
                  <p key={row.city}>{row.city} ({row.vendorCount})</p>
                ))}
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Delivery channels: Vendor Portal + WhatsApp
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canRelease || busy || selected.size === 0 || loading}
            onClick={confirmRelease}
          >
            {busy ? "Releasing..." : "Release to Vendors"}
          </Button>
        </div>
      </div>
    </div>
  );
}
