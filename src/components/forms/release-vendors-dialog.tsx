"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { readJsonBody, reportApiFailure, resolveApiError } from "@/lib/api-client";
import { deliveryZoneLabel, type ReleaseFilterZone } from "@/lib/delivery-zones";
import { useToast } from "@/components/toast";

type CityOption = { city: string; vendorCount: number };
type ZoneOption = { value: ReleaseFilterZone; label: string };

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
  const toast = useToast();
  const router = useRouter();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [zoneOptions, setZoneOptions] = useState<ZoneOption[]>([]);
  const [releasedCities, setReleasedCities] = useState<string[]>([]);
  const [releasedZones, setReleasedZones] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedZones, setSelectedZones] = useState<Set<ReleaseFilterZone>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const zonesQuery = useMemo(
    () => Array.from(selectedZones).sort().join(","),
    [selectedZones]
  );

  const loadOptions = useCallback(() => {
    setLoading(true);
    const zonesPart = zonesQuery ? `&zones=${encodeURIComponent(zonesQuery)}` : "";
    return fetch(`/api/vendors/release-cities?indentId=${encodeURIComponent(indentId)}${zonesPart}`)
      .then(async (res) => {
        const data = await readJsonBody(res);
        if (!res.ok) {
          throw new Error(resolveApiError(res, data, "Failed to load vendor cities").message);
        }
        const body = data as {
          cities?: CityOption[];
          releasedCities?: string[];
          releasedZones?: string[];
          zoneOptions?: ZoneOption[];
        };
        setCities(body.cities ?? []);
        setReleasedCities(body.releasedCities ?? []);
        setReleasedZones(body.releasedZones ?? []);
        if (body.zoneOptions?.length) setZoneOptions(body.zoneOptions);
      })
      .catch((err: unknown) => {
        setCities([]);
        setReleasedCities([]);
        setReleasedZones([]);
        setError(err instanceof Error ? err.message : "Failed to load vendor cities");
      })
      .finally(() => setLoading(false));
  }, [indentId, zonesQuery]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSearch("");
    setSelected(new Set());
    setSelectedZones(new Set());
  }, [open, indentId]);

  useEffect(() => {
    if (!open) return;
    void loadOptions();
  }, [open, loadOptions]);

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

  function toggleZone(zone: ReleaseFilterZone) {
    setSelectedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
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
      body: JSON.stringify({
        action: "release",
        cities: Array.from(selected),
        zones: Array.from(selectedZones),
      }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Release failed" });
      return;
    }
    onClose();
    router.refresh();
  }

  if (!open) return null;

  const defaultZoneOptions: ZoneOption[] = [
    { value: "NORTH", label: "North" },
    { value: "SOUTH", label: "South" },
    { value: "EAST", label: "East" },
    { value: "WEST", label: "West" },
  ];
  const zonesForUi = zoneOptions.length > 0 ? zoneOptions : defaultZoneOptions;

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
              Previously released to cities: {releasedCities.join(", ")}
              {releasedZones.length > 0 && (
                <span className="block mt-1 text-cyan-800">
                  Zones used: {releasedZones.map(deliveryZoneLabel).join(", ")}
                </span>
              )}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Advanced filter: delivery zones <span className="font-normal text-slate-500">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {zonesForUi.map((opt) => {
                const checked = selectedZones.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleZone(opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      checked
                        ? "border-blue-600 bg-blue-50 text-blue-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {selectedZones.size > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Showing vendors in selected cities who deliver to{" "}
                {Array.from(selectedZones).map(deliveryZoneLabel).join(" or ")}.
              </p>
            )}
          </div>

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
              {cities.length === 0
                ? selectedZones.size > 0
                  ? "No vendor cities match the selected delivery zones."
                  : "No registered vendor cities found."
                : "No cities match your search."}
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
              {selectedZones.size > 0 && (
                <p className="text-slate-600">
                  Delivery zones: {Array.from(selectedZones).map(deliveryZoneLabel).join(", ")}
                </p>
              )}
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
