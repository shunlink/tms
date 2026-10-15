import Link from "next/link";
import { LayoutList } from "lucide-react";
import Kanban, { type KanbanColumn } from "@/components/kanban";
import { getTrips } from "@/lib/queries";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const columns: KanbanColumn[] = [
  { key: "PENDING", label: "Pending" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "POD_RECEIVED", label: "POD Received" },
  { key: "INVOICED", label: "Invoiced" },
  { key: "CLOSED", label: "Closed" },
];

export default async function TripsBoardPage() {
  const trips = await getTrips();

  const items = trips.map((t) => ({
    id: t.id,
    column: t.status,
    title: t.lrNumber,
    subtitle: `${t.route}`,
    meta: `${t.client} · ${formatINR(t.margin)}`,
    href: `/trips/${t.id}`,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trips Board</h1>
          <p className="text-muted-foreground">Drag a trip to change its status</p>
        </div>
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm hover:bg-accent"
        >
          <LayoutList className="h-4 w-4" /> List view
        </Link>
      </div>

      <Kanban
        columns={columns}
        items={items}
        endpoint="/api/trips/{id}"
        method="PATCH"
        bodyKey="status"
      />
    </div>
  );
}
