"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Donut, { type DonutSegment } from "@/components/donut";

export type MetricBucket = {
  key: string;
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
};

function StatRow({
  label,
  value,
  highlight,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center justify-between py-3 border-b border-dashed border-border last:border-0 text-base text-left ${
        onClick ? "hover:bg-muted/50 rounded-md px-1 -mx-1 transition-colors" : ""
      } ${active ? "bg-muted/40" : ""}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? "text-green-700" : "text-foreground"}`}>{value}</span>
    </Tag>
  );
}

type View = "indents" | "bookings";

export default function OrdersBookingsCard({
  bookingBuckets,
  indentBuckets,
  tripsTotal,
  totalIndents,
}: {
  bookingBuckets: MetricBucket[];
  indentBuckets: MetricBucket[];
  tripsTotal: number;
  totalIndents: number;
}) {
  const [view, setView] = useState<View>("bookings");
  const [chartLoading, setChartLoading] = useState(false);

  const switchView = useCallback((next: View) => {
    if (next === view) return;
    setChartLoading(true);
    setView(next);
    window.setTimeout(() => setChartLoading(false), 320);
  }, [view]);

  const activeBuckets = view === "bookings" ? bookingBuckets : indentBuckets;
  const centerValue = view === "bookings" ? tripsTotal : totalIndents;
  const centerLabel = view === "bookings" ? "Bookings" : "Indents";

  const chartSegments: DonutSegment[] = activeBuckets
    .filter((b) => b.value > 0)
    .map((b) => ({ label: b.label, value: b.value, color: b.color }));

  const displaySegments =
    chartSegments.length > 0 ? chartSegments : [{ label: "Empty", value: 1, color: "#E8E6E1" }];

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Orders &amp; Bookings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div>
            <button
              type="button"
              onClick={() => switchView("indents")}
              className={`text-sm font-semibold uppercase tracking-wide mb-2 transition-colors ${
                view === "indents"
                  ? "text-primary underline underline-offset-4"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Indents
            </button>
            <StatRow label="Total Indents" value={totalIndents} />
            {indentBuckets.map((b) => (
              <StatRow
                key={b.key}
                label={b.label}
                value={b.value}
                highlight={b.highlight}
                active={view === "indents"}
                onClick={() => switchView("indents")}
              />
            ))}
          </div>

          <div>
            <button
              type="button"
              onClick={() => switchView("bookings")}
              className={`text-sm font-semibold uppercase tracking-wide mb-2 transition-colors ${
                view === "bookings"
                  ? "text-primary underline underline-offset-4"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bookings
            </button>
            <StatRow label="Total Bookings" value={tripsTotal} />
            {bookingBuckets.map((b) => (
              <StatRow
                key={b.key}
                label={b.label}
                value={b.value}
                highlight={b.highlight}
                active={view === "bookings"}
                onClick={() => switchView("bookings")}
              />
            ))}
          </div>

          <div className="flex flex-col items-center">
            <Donut
              segments={displaySegments}
              centerValue={centerValue}
              centerLabel={centerLabel}
              loading={chartLoading}
              animate={!chartLoading}
            />
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 text-sm">
              {activeBuckets.map((b) => (
                <span key={b.key} className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  {b.label} {b.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
