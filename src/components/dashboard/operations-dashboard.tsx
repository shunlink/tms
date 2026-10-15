import Link from "next/link";
import {
  Truck,
  ClipboardCheck,
  FileCheck,
  AlertTriangle,
  MapPin,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import PendingTasksSection from "@/components/dashboard/pending-tasks-section";
import ExpandableListCard from "@/components/expandable-list-card";
import type { OperationsDashboardData } from "@/lib/team-dashboard-types";

export default function OperationsDashboard({ data }: { data: OperationsDashboardData }) {
  return (
    <div>
      <PageHeader
        title="Operations Dashboard"
        description="Trips, POD, placement, and operational events"
      />

      <div className="mb-8">
        <PendingTasksSection tasks={data.pendingTasks} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Truck} value={data.activeTrips} label="Active Trips" />
        <StatCard icon={MapPin} value={data.myTrips} label="My Active Trips" />
        <StatCard icon={FileCheck} value={data.podsUploaded} label="POD Uploaded" />
        <StatCard icon={ClipboardCheck} value={data.podsPendingVerification} label="POD Verification Pending" />
        <StatCard icon={AlertTriangle} value={data.badPods} label="Bad POD Awaiting Correction" />
        <StatCard icon={AlertTriangle} value={data.podEscalations} label="POD Escalations (SLA Breached)" />
        <StatCard icon={Package} value={data.tripsAwaitingPod} label="Delivered — Awaiting POD" />
        <StatCard icon={ClipboardCheck} value={data.indentsReadyToClose} label="Indents Ready to Close" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Placement & POD Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between border-b pb-3">
                <span className="text-muted-foreground">Placement pending</span>
                <span className="font-semibold tabular-nums">{data.placementPending}</span>
              </div>
              <div className="flex justify-between border-b pb-3">
                <span className="text-muted-foreground">POD verification pending</span>
                <span className="font-semibold tabular-nums">{data.podsPendingVerification}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bad POD awaiting correction</span>
                <span className="font-semibold tabular-nums">{data.badPods}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <ExpandableListCard
          title="Operational Events"
          initialCount={5}
          emptyMessage="No open operational events."
        >
          {data.importantEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 border-l-4 border-accent bg-amber-50/50 rounded-r-lg px-4 py-3"
            >
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${event.severity === "CRITICAL" ? "bg-red-600" : "bg-amber-600"}`} />
              <div>
                {event.indentId ? (
                  <Link href={`/indents/${event.indentId}`} className="font-semibold text-primary hover:underline">
                    {event.title}
                  </Link>
                ) : (
                  <p className="font-semibold">{event.title}</p>
                )}
                {event.indentNumber && (
                  <p className="text-xs text-muted-foreground mt-0.5">{event.indentNumber}</p>
                )}
              </div>
            </div>
          ))}
        </ExpandableListCard>
      </div>

      <ExpandableListCard
        title="Recent Trips"
        initialCount={5}
        viewAllHref="/trips"
        emptyMessage="No trips yet."
      >
        {data.recentTrips.map((trip) => (
          <div key={trip.id} className="flex items-center justify-between border-b border-border pb-4 last:border-0">
            <div>
              <Link href={`/trips/${trip.id}`} className="font-semibold text-primary hover:underline">
                {trip.lrNumber}
              </Link>
              <p className="text-sm text-muted-foreground mt-0.5">{trip.route}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{trip.client}</p>
              <StatusBadge status={trip.status} className="mt-1" />
            </div>
          </div>
        ))}
      </ExpandableListCard>
    </div>
  );
}
