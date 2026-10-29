"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildChartSeries,
  sortLeaderboardBids,
  type AuctionBidRow,
} from "@/lib/bidding/auction-bids";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AuctionLiveMonitorProps = {
  status: string;
  events: AuctionBidRow[];
  standingBids: AuctionBidRow[];
  loading: boolean;
  error: string;
  liveConnected: boolean;
  participantCount?: number;
  onCloseAuction?: () => void;
};

type TooltipPayload = {
  vendorName: string;
  timeLabel: string;
  amount: number;
};

function BidPriceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TooltipPayload }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{point.vendorName}</p>
      <p className="text-slate-600 mt-0.5">{point.timeLabel}</p>
      <p className="text-emerald-700 font-medium mt-1">{formatINR(point.amount)}</p>
    </div>
  );
}

function formatYAxisTick(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
  return `₹${value}`;
}

export default function AuctionLiveMonitor({
  status,
  events,
  standingBids,
  loading,
  error,
  liveConnected,
  participantCount,
  onCloseAuction,
}: AuctionLiveMonitorProps) {
  const isLive = status === "AUCTION_LIVE";

  const chartSeries = useMemo(() => buildChartSeries(events), [events]);
  const leaderboardBids = useMemo(() => sortLeaderboardBids(standingBids), [standingBids]);
  const tapeEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        if (b.placedAtMs !== a.placedAtMs) return b.placedAtMs - a.placedAtMs;
        return b.id.localeCompare(a.id);
      }),
    [events]
  );

  const yDomain = useMemo((): [number, number] => {
    if (!chartSeries.length) return [0, 100];
    const amounts = chartSeries.map((p) => p.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const span = max - min;
    const pad = span > 0 ? span * 0.08 : Math.max(max * 0.05, 500);
    return [Math.max(0, min - pad), max + pad];
  }, [chartSeries]);

  const showEmpty =
    !loading && !error && chartSeries.length === 0 && leaderboardBids.length === 0;

  return (
    <div className="space-y-4">
      {isLive && onCloseAuction && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-600">
            {liveConnected ? "Receiving live price drops." : "Live stream offline — polling bid history."}
            {participantCount != null ? (
              <span className="ml-2 font-medium text-slate-800">
                · {participantCount} vendor{participantCount === 1 ? "" : "s"} bidding
              </span>
            ) : null}
          </p>
          <Button type="button" variant="destructive" className="sm:w-auto w-full shrink-0" onClick={onCloseAuction}>
            Close Auction
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-2.5 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Price drop timeline</h3>
          <p className="text-xs text-slate-500 mt-0.5">Every bid event (INR)</p>
        </div>
        <div className="px-2 py-4 h-56">
          {loading && chartSeries.length === 0 ? (
            <p className="px-2 text-sm text-slate-500">Loading chart…</p>
          ) : showEmpty ? (
            <p className="px-2 text-sm text-slate-500">No bids to chart yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={formatYAxisTick}
                  width={52}
                />
                <Tooltip content={<BidPriceTooltip />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#10b981", stroke: "#047857", strokeWidth: 1 }}
                  activeDot={{ r: 6, fill: "#10b981", stroke: "#065f46" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-2.5 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Event tape</h3>
          <p className="text-xs text-slate-500 mt-0.5">Newest first</p>
        </div>
        {tapeEvents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No events yet.</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-sm">
            {tapeEvents.map((bid) => (
              <li key={bid.id} className="px-4 py-2 flex justify-between gap-3">
                <span className="text-slate-600 truncate">{bid.vendorName}</span>
                <span className="shrink-0 tabular-nums font-medium">{formatINR(bid.amount)}</span>
                <span className="shrink-0 text-xs text-slate-400">{bid.placedAtLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Standing bids</h3>
          <span className="text-xs text-slate-500">Final bid per vendor (lowest first)</span>
        </div>
        {loading && leaderboardBids.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading bid history…</p>
        ) : error && leaderboardBids.length === 0 ? (
          <p className="px-4 py-6 text-sm text-red-700">{error}</p>
        ) : leaderboardBids.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No bids yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Vendor name</th>
                  <th className="px-4 py-2 font-medium text-right">Bid amount</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardBids.map((bid, index) => {
                  const isLeader = index === 0;
                  return (
                    <tr
                      key={bid.id}
                      className={
                        isLeader
                          ? "bg-emerald-100/90 font-semibold text-emerald-950"
                          : "border-t border-slate-100 text-slate-800"
                      }
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">{bid.placedAtLabel}</td>
                      <td className="px-4 py-2.5">{bid.vendorName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(bid.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
