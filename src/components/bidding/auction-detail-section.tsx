"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Radio } from "lucide-react";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { useAuctionBidFeed } from "@/hooks/use-auction-bid-feed";
import AuctionLiveMonitor from "@/components/bidding/auction-live-monitor";
import AuctionCurationSection from "@/components/bidding/auction-curation-section";
import RequirementReviewPanel from "@/components/bidding/requirement-review-panel";
import {
  fetchBiddingProxyPost,
  formatBiddingProxyError,
  loadRequirementDetail,
} from "@/lib/bidding/admin-api";
import {
  displayFromDetail,
  isRealAuctionId,
  normalizeRequirementPayload,
  pickNumber,
  resolveAuctionHeaderDisplay,
  resolveEffectiveAuctionId,
  resolveRequirementStatus,
} from "@/lib/bidding/requirement-display";
import { sortLeaderboardBids } from "@/lib/bidding/auction-bids";
import { useToast } from "@/components/toast";

export default function AuctionDetailSection({
  auctionIdParam,
  requirementId,
}: {
  auctionIdParam: string;
  requirementId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const auctionId = useMemo(
    () => resolveEffectiveAuctionId(auctionIdParam, requirementId, detail),
    [auctionIdParam, requirementId, detail]
  );

  const refreshDetail = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (!requirementId.trim()) return null;
    setLoading(true);
    setLoadError("");
    const result = await loadRequirementDetail(requirementId);
    const data = result.data ?? null;
    setDetail(data);
    if (result.error) setLoadError(result.error);
    setLoading(false);
    return data;
  }, [requirementId]);

  useEffect(() => {
    refreshDetail();
  }, [refreshDetail]);

  useEffect(() => {
    if (!detail || !auctionId) return;
    const param = auctionIdParam.trim();
    if (param && param !== "pending" && param !== auctionId && param === requirementId.trim()) {
      router.replace(
        `/bidding-management/auctions/${encodeURIComponent(auctionId)}?requirementId=${encodeURIComponent(requirementId)}`
      );
    }
  }, [detail, auctionId, auctionIdParam, requirementId, router]);

  const hasAuction = Boolean(auctionId) && isRealAuctionId(auctionId, requirementId);
  const detailStatus = resolveRequirementStatus(detail, "");

  const {
    events,
    standing,
    loading: bidsLoading,
    error: bidsError,
    liveConnected,
    reload: reloadBids,
    bidsMeta,
    requirementStatus: bidsRequirementStatus,
  } = useAuctionBidFeed({
    auctionId,
    enabled: hasAuction,
    live: detailStatus === "AUCTION_LIVE",
  });

  const status = resolveRequirementStatus(detail, bidsRequirementStatus);
  const header = resolveAuctionHeaderDisplay(detail, bidsMeta);
  const cargo = displayFromDetail(
    detail ? normalizeRequirementPayload(detail) : null,
    null
  );
  const showBidMonitor =
    hasAuction && (status === "AUCTION_LIVE" || status === "AUCTION_CLOSED");

  const currentLowest =
    pickNumber(detail ?? {}, ["currentLowestPrice", "lowestPrice", "lowestBidPrice"]) ??
    (standing.length ? sortLeaderboardBids(standing)[0].amount : null);

  async function proxyPost(path: string, body?: unknown) {
    setActionError("");
    setActionBusy(true);
    const { ok, data, status: httpStatus } = await fetchBiddingProxyPost(path, body);
    setActionBusy(false);
    if (!ok) {
      const message = formatBiddingProxyError(httpStatus, data, "Request failed");
      setActionError(message);
      toast.push({ title: message, variant: "error" });
      return false;
    }
    const refreshed = await refreshDetail();
    const nextAuctionId = resolveEffectiveAuctionId(auctionIdParam, requirementId, refreshed ?? null);
    if (showBidMonitor && nextAuctionId) await reloadBids();
    return true;
  }

  if (!requirementId.trim()) {
    return (
      <div className="space-y-4">
        <p className="text-red-700">Missing requirementId. Open this page from the live auction desk.</p>
        <Link href="/bidding-management" className="text-primary font-medium hover:underline">
          Back to live auction desk
        </Link>
      </div>
    );
  }

  const needsAuctionForMonitor =
    (status === "AUCTION_LIVE" || status === "AUCTION_CLOSED") && !auctionId && !loading;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/bidding-management"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Live auction desk
        </Link>
        <PageHeader
          title={header.title !== "—" ? header.title : header.clientName}
          description={`${header.origin} → ${header.destination}`}
        />
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          <StatusBadge status={status} />
          <span className="text-xs text-slate-500 font-mono">Req {requirementId}</span>
          {auctionId && <span className="text-xs text-slate-500 font-mono">Auction {auctionId}</span>}
          {loading && <span className="text-xs text-slate-500">Updating…</span>}
          {status === "AUCTION_LIVE" && liveConnected && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Radio className="h-3 w-3 animate-pulse" aria-hidden />
              Live
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {cargo.material}
          {cargo.quantityDisplay !== "—" ? ` · ${cargo.quantityDisplay}` : ""}
          {cargo.vehicleType !== "—" ? ` · ${cargo.vehicleType}` : ""}
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </div>
      )}

      {needsAuctionForMonitor && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No auction id on this requirement yet. Refresh the desk list or reload after starting the auction.
          Auction APIs (bids, close, curate) require <span className="font-mono">auction.id</span>, not the
          requirement id.
        </div>
      )}

      {actionBusy && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Processing…
        </div>
      )}

      {detail && (status === "PUBLISHED" || status === "AUCTION_LIVE" || status === "AUCTION_CLOSED") && (
        <RequirementReviewPanel detail={detail} />
      )}

      {currentLowest != null && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 max-w-md">
          <p className="text-xs font-medium text-emerald-800">Current lowest price</p>
          <p className="text-xl font-semibold text-emerald-900">{formatINR(currentLowest)}</p>
        </div>
      )}

      {showBidMonitor && (
        <AuctionLiveMonitor
          status={status}
          events={events}
          standingBids={standing}
          loading={bidsLoading}
          error={bidsError}
          liveConnected={liveConnected}
          participantCount={bidsMeta.participantCount}
          onCloseAuction={
            status === "AUCTION_LIVE"
              ? () => proxyPost(`admin/auctions/${encodeURIComponent(auctionId)}/close`)
              : undefined
          }
        />
      )}

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-sm">{actionError}</div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Actions</h3>

        {status === "PUBLISHED" && (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">
              Review the load details above, then start the auction to notify carriers on the bidding platform.
            </p>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => proxyPost(`admin/requirements/${encodeURIComponent(requirementId)}/auction`)}
            >
              Start Auction
            </Button>
          </div>
        )}

        {status === "AUCTION_CLOSED" && auctionId && (
          <AuctionCurationSection auctionId={auctionId} onCurated={refreshDetail} />
        )}

        {status === "AWARDED" && (
          <div className="space-y-2">
            {(() => {
              const flat = detail ? normalizeRequirementPayload(detail) : null;
              const handoff = flat?.tmsHandoff as
                | { status?: string; lastError?: string | null; indentNumber?: string | null }
                | undefined;
              if (handoff?.status === "FAILED" || handoff?.status === "PENDING") {
                return (
                  <p className="text-xs text-amber-800">
                    TMS handoff {handoff.status === "FAILED" ? "failed" : "pending"}.
                    {handoff.lastError ? ` ${handoff.lastError}` : ""}
                  </p>
                );
              }
              return null;
            })()}
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() =>
                proxyPost(`admin/requirements/${encodeURIComponent(requirementId)}/create-indent`)
              }
            >
              Retry TMS handoff
            </Button>
          </div>
        )}

        {status === "INDENT_CREATED" && (
          <p className="text-sm text-emerald-800">
            Indent created in TMS.
            {(() => {
              const flat = detail ? normalizeRequirementPayload(detail) : null;
              const handoff = flat?.tmsHandoff as { indentNumber?: string | null } | undefined;
              return handoff?.indentNumber ? ` ${handoff.indentNumber}` : "";
            })()}
          </p>
        )}

        {!["PUBLISHED", "AUCTION_LIVE", "AUCTION_CLOSED", "AWARDED", "INDENT_CREATED"].includes(
          status,
        ) && (
          <p className="text-xs text-slate-500">
            No actions available for status <span className="font-mono">{status}</span>.
          </p>
        )}
      </div>
    </div>
  );
}
