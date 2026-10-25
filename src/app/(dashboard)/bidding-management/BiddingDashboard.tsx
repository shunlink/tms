"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/page-header";
import DataTable, { type DataColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import { formatINR } from "@/lib/utils";
import { sortLeaderboardBids } from "@/lib/bidding/auction-bids";
import { useAuctionBidFeed } from "@/hooks/use-auction-bid-feed";
import AuctionLiveMonitor from "@/components/bidding/auction-live-monitor";
import { RefreshCw, Radio } from "lucide-react";

import { readJsonBody, reportApiFailure, resolveApiError } from "@/lib/api-client";
import { useToast } from "@/components/toast";
type RequirementRow = {
  id: string;
  clientName: string;
  origin: string;
  destination: string;
  material: string;
  quantityDisplay: string;
  vehicleType: string;
  status: string;
  lowestPrice: number | null;
  raw: Record<string, unknown>;
};

type CurateRow = {
  vendorCompanyId: string;
  vendorPrice: string;
  clientPrice: string;
};

const LIST_COLUMNS: DataColumn[] = [
  { key: "id", header: "ID" },
  { key: "clientName", header: "Client" },
  { key: "origin", header: "Origin" },
  { key: "destination", header: "Destination" },
  { key: "status", header: "Status", kind: "badge" },
  { key: "lowestPrice", header: "Lowest Price", align: "right", kind: "money" },
];

function emptyCurateRows(): CurateRow[] {
  return Array.from({ length: 5 }, () => ({
    vendorCompanyId: "",
    vendorPrice: "",
    clientPrice: "",
  }));
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return "—";
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function resolveOrigin(item: Record<string, unknown>): string {
  const direct = pickString(item, ["origin"]);
  if (direct !== "—") return direct;
  const lane = item.lane as Record<string, unknown> | undefined;
  const from = (lane?.from ?? item.routeFrom) as Record<string, unknown> | string | undefined;
  if (typeof from === "string" && from.trim()) return from.trim();
  return pickString((from as Record<string, unknown>) ?? {}, ["city", "addressLine1", "partyName"]);
}

function resolveDestination(item: Record<string, unknown>): string {
  const direct = pickString(item, ["destination"]);
  if (direct !== "—") return direct;
  const lane = item.lane as Record<string, unknown> | undefined;
  const to = (lane?.to ?? item.routeTo) as Record<string, unknown> | string | undefined;
  if (typeof to === "string" && to.trim()) return to.trim();
  return pickString((to as Record<string, unknown>) ?? {}, ["city", "addressLine1", "partyName"]);
}

function resolveClientName(item: Record<string, unknown>): string {
  const direct = pickString(item, ["clientName"]);
  if (direct !== "—") return direct;
  const clientObj = item.client as Record<string, unknown> | undefined;
  if (clientObj && typeof item.client === "object") {
    return pickString(clientObj, ["name", "legalName", "tradeName", "displayName"]);
  }
  return pickString(item, ["client"]);
}

function resolveCargoField(item: Record<string, unknown>, keys: string[]): string {
  const direct = pickString(item, keys);
  if (direct !== "—") return direct;
  const cargo = item.cargo as Record<string, unknown> | undefined;
  if (cargo) return pickString(cargo, keys);
  return "—";
}

function normalizeRequirement(item: Record<string, unknown>): RequirementRow {
  const lowest =
    pickNumber(item, ["lowestPrice", "currentLowestPrice", "lowestBidPrice"]) ??
    pickNumber(item, ["lowestPriceInr", "currentLowestPriceInr"]);

  const id = pickString(item, ["id", "requirementId", "_id"]);
  return {
    id: id === "—" ? String(item.id ?? "") : id,
    clientName: resolveClientName(item),
    origin: resolveOrigin(item),
    destination: resolveDestination(item),
    material: resolveCargoField(item, [
      "material",
      "materialDescription",
      "cargoDescription",
      "description",
    ]),
    quantityDisplay: resolveCargoField(item, ["quantityDisplay", "quantity", "packageCount"]),
    vehicleType: resolveCargoField(item, ["vehicleType", "vehicleTypeCode", "vehicleCategory"]),
    status: coerceStatus(item.status),
    lowestPrice: lowest,
    raw: item,
  };
}

function displayFromDetail(
  detail: Record<string, unknown> | null,
  selected: RequirementRow | null
): Pick<RequirementRow, "clientName" | "origin" | "destination" | "material" | "quantityDisplay" | "vehicleType"> {
  if (detail) {
    return {
      clientName: resolveClientName(detail),
      origin: resolveOrigin(detail),
      destination: resolveDestination(detail),
      material: resolveCargoField(detail, ["material", "materialDescription", "cargoDescription", "description"]),
      quantityDisplay: resolveCargoField(detail, ["quantityDisplay", "quantity", "packageCount"]),
      vehicleType: resolveCargoField(detail, ["vehicleType", "vehicleTypeCode", "vehicleCategory"]),
    };
  }
  if (selected) {
    return {
      clientName: selected.clientName,
      origin: selected.origin,
      destination: selected.destination,
      material: selected.material,
      quantityDisplay: selected.quantityDisplay,
      vehicleType: selected.vehicleType,
    };
  }
  return {
    clientName: "—",
    origin: "—",
    destination: "—",
    material: "—",
    quantityDisplay: "—",
    vehicleType: "—",
  };
}

/** Avoid React #31 when APIs return nested `{ code, message }` error objects. */
function formatApiError(data: unknown, fallback: string): string {
  if (data == null) return fallback;
  if (typeof data === "string") return data;
  if (typeof data !== "object") return fallback;

  const o = data as Record<string, unknown>;

  if (typeof o.error === "string") return o.error;
  if (o.error && typeof o.error === "object") {
    const err = o.error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
    if (typeof err.code === "string" && typeof err.message === "string") {
      return `${err.code}: ${err.message}`;
    }
  }

  if (typeof o.message === "string") {
    if (typeof o.code === "string") return `${o.code}: ${o.message}`;
    return o.message;
  }

  if (o.raw && typeof o.raw === "string") {
    const raw = o.raw.trim();
    if (raw.length <= 200) return raw;
    return fallback;
  }

  return fallback;
}

function actionErrorMessage(data: unknown, status: number, fallback: string): string {
  const msg = formatApiError(data, fallback);
  if (msg !== fallback) return msg;
  if (status === 404) return "That action was not found on the Bidding server.";
  if (status === 502) return "TMS could not reach the Bidding service.";
  if (status === 503) return "Bidding integration is not configured on the server.";
  return fallback;
}

function resolveAuctionId(
  detail: Record<string, unknown> | null,
  raw?: Record<string, unknown>
): string {
  const sources = [detail, raw].filter((s): s is Record<string, unknown> => Boolean(s));
  for (const item of sources) {
    const auction = item.auction;
    if (auction && typeof auction === "object") {
      const id = (auction as Record<string, unknown>).id;
      if (id != null && String(id).trim()) return String(id).trim();
    }
    const auctionId = item.auctionId;
    if (auctionId != null && String(auctionId).trim()) return String(auctionId).trim();
  }
  return "";
}

function coerceStatus(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.code === "string") return o.code;
    if (typeof o.name === "string") return o.name;
    if (typeof o.status === "string") return o.status;
  }
  return String(value);
}

function extractListPayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["requirements", "items", "data", "active"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

export default function BiddingDashboard() {
  const toast = useToast();
  const [rows, setRows] = useState<RequirementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<RequirementRow | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [curateRows, setCurateRows] = useState<CurateRow[]>(emptyCurateRows());

  const tableRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        id: r.id,
        lowestPrice: r.lowestPrice ?? undefined,
      })),
    [rows]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const res = await fetch("/api/bidding-proxy/admin/requirements/active");
      const data = await readJsonBody(res);
      if (!res.ok) {
        const hint =
          res.status === 503
            ? "Check BIDDING_SERVICE_URL and BIDDING_TMS_INTEGRATION_SECRET on the TMS server."
            : res.status >= 500
              ? "The Bidding service returned an error or TMS could not reach it."
              : undefined;
        const fallback = hint ? `Failed to load requirements. ${hint}` : "Failed to load requirements";
        const err = resolveApiError(res, data, fallback);
        setListError(err.message);
        setRows([]);
        return;
      }
      const list = extractListPayload(data);
      setRows(list.map((item) => normalizeRequirement(item)));
    } catch {
      setListError("Network error while loading requirements");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = async (row: RequirementRow) => {
    setSelected(row);
    setDetail(row.raw);
    setActionError("");
    setCurateRows(emptyCurateRows());
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/bidding-proxy/admin/requirements/${encodeURIComponent(row.id)}`);
      const data = await readJsonBody(res);
      if (res.ok && data && typeof data === "object") {
        setDetail(data as Record<string, unknown>);
      }
    } catch {
      // keep list row snapshot
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
    setActionError("");
  };

  const status = detail ? coerceStatus(detail.status) : selected?.status ?? "";

  const currentLowest =
    detail
      ? pickNumber(detail, ["currentLowestPrice", "lowestPrice", "lowestBidPrice", "currentLowestPriceInr"])
      : selected?.lowestPrice ?? null;

  async function proxyPost(path: string, body?: unknown) {
    setActionError("");
    setActionBusy(true);
    const res = await fetch(`/api/bidding-proxy/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : "{}",
    });
    setActionBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError: setActionError, fallback: "Request failed" });
      return false;
    }
    await loadList();
    if (selected) {
      await openDetail(selected);
    }
    return true;
  }

  const requirementId = selected?.id ?? "";
  const auctionId = resolveAuctionId(detail, selected?.raw);
  const display = displayFromDetail(detail, selected);

  function requireAuctionId(): string | null {
    if (auctionId) return auctionId;
    setActionError("Auction ID is missing. Refresh the requirement detail and try again.");
    return null;
  }

  const showBidLeaderboard = status === "AUCTION_LIVE" || status === "AUCTION_CLOSED";
  const {
    bids: auctionBids,
    loading: bidsLoading,
    error: bidsError,
    liveConnected,
  } = useAuctionBidFeed({
    auctionId,
    enabled: Boolean(selected && showBidLeaderboard && auctionId),
    live: status === "AUCTION_LIVE",
  });

  const displayLowest =
    auctionBids.length > 0 ? sortLeaderboardBids(auctionBids)[0].amount : currentLowest;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bidding System"
        description="Manage load requirements, auctions, and awards from the Bidding platform."
        action={
          <Button type="button" variant="outline" size="sm" onClick={loadList} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {listError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {listError}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading active requirements…</p>
      ) : (
        <DataTable
          rows={tableRows}
          columns={LIST_COLUMNS}
          searchKeys={["id", "clientName", "origin", "destination", "status", "material", "vehicleType"]}
          pageSize={15}
          exportName="bidding-requirements"
          emptyText="No active requirements."
          onRowClick={(row) => {
            const match = rows.find((r) => r.id === row.id);
            if (match) openDetail(match);
          }}
        />
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
            {actionBusy && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              </div>
            )}
            <div className="flex items-start justify-between border-b px-5 py-4 bg-slate-50">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Client</p>
                <h2 className="text-lg font-semibold text-slate-900 truncate">{display.clientName}</h2>
                <p className="mt-1 text-sm text-slate-700">
                  {display.origin} → {display.destination}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {display.material}
                  {display.quantityDisplay !== "—" ? ` · ${display.quantityDisplay}` : ""}
                  {display.vehicleType !== "—" ? ` · ${display.vehicleType}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="text-xs text-slate-500 font-mono">Req {selected.id}</span>
                  {detailLoading && <span className="text-xs text-slate-500">Updating…</span>}
                  {status === "AUCTION_LIVE" && liveConnected && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Radio className="h-3 w-3 animate-pulse" aria-hidden />
                      Live
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="text-2xl leading-none text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
              {displayLowest != null && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                  <p className="text-xs font-medium text-emerald-800">Current lowest price</p>
                  <p className="text-xl font-semibold text-emerald-900">{formatINR(displayLowest)}</p>
                </div>
              )}

              {showBidLeaderboard && (
                <AuctionLiveMonitor
                  status={status}
                  bids={auctionBids}
                  loading={bidsLoading}
                  error={bidsError}
                  liveConnected={liveConnected}
                  onCloseAuction={
                    status === "AUCTION_LIVE"
                      ? () => {
                          const id = requireAuctionId();
                          if (!id) return;
                          proxyPost(`admin/auctions/${encodeURIComponent(id)}/close`);
                        }
                      : undefined
                  }
                />
              )}

              {actionError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                  {actionError}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Actions</h3>

                {status === "AUCTION_LIVE" && (
                  <p className="text-xs text-slate-600">
                    Auction is live. Monitor bids in the leaderboard above; close the auction when ready.
                  </p>
                )}

                {status === "PUBLISHED" && (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => proxyPost(`admin/requirements/${requirementId}/auction`)}
                  >
                    Start Auction
                  </Button>
                )}

                {status === "AUCTION_CLOSED" && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">Curate up to 5 vendor quotes for client review.</p>
                    {curateRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-white p-2">
                        <input
                          className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                          placeholder="Vendor company ID"
                          value={row.vendorCompanyId}
                          onChange={(e) => {
                            const next = [...curateRows];
                            next[idx] = { ...next[idx], vendorCompanyId: e.target.value };
                            setCurateRows(next);
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                            placeholder="Vendor price"
                            value={row.vendorPrice}
                            onChange={(e) => {
                              const next = [...curateRows];
                              next[idx] = { ...next[idx], vendorPrice: e.target.value };
                              setCurateRows(next);
                            }}
                          />
                          <input
                            type="number"
                            className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                            placeholder="Client price"
                            value={row.clientPrice}
                            onChange={(e) => {
                              const next = [...curateRows];
                              next[idx] = { ...next[idx], clientPrice: e.target.value };
                              setCurateRows(next);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => {
                        const quotes = curateRows
                          .filter((r) => r.vendorCompanyId.trim())
                          .map((r) => ({
                            vendorCompanyId: r.vendorCompanyId.trim(),
                            vendorPrice: Number(r.vendorPrice),
                            clientPrice: Number(r.clientPrice),
                          }));
                        if (!quotes.length) {
                          setActionError("Add at least one quote row with a vendor company ID");
                          return;
                        }
                        const id = requireAuctionId();
                        if (!id) return;
                        proxyPost(`admin/auctions/${encodeURIComponent(id)}/curate`, { quotes });
                      }}
                    >
                      Submit curated quotes
                    </Button>
                  </div>
                )}

                {status === "AWARDED" && (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => proxyPost(`admin/requirements/${requirementId}/create-indent`)}
                  >
                    Create Indent
                  </Button>
                )}

                {!["PUBLISHED", "AUCTION_LIVE", "AUCTION_CLOSED", "AWARDED"].includes(status) && (
                  <p className="text-xs text-slate-500">
                    No actions available for status <span className="font-mono">{status}</span>.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
