import Link from "next/link";
import { LayoutList } from "lucide-react";
import Kanban, { type KanbanColumn } from "@/components/kanban";
import { getIndents } from "@/lib/queries";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const columns: KanbanColumn[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "WAITING_FOR_ADVANCE", label: "Advance" },
  { key: "RELEASED_TO_VENDORS", label: "Released" },
  { key: "QUOTING", label: "Quoting" },
  { key: "PLACEMENT_PENDING", label: "Placement" },
  { key: "VEHICLE_PLACED", label: "Vehicle Placed" },
  { key: "DRIVER_ASSIGNED", label: "Driver Assigned" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "POD_PENDING", label: "POD" },
  { key: "COMPLETED", label: "Completed" },
];

export default async function IndentsBoardPage() {
  const indents = await getIndents();

  const items = indents.map((i) => ({
    id: i.id,
    column: i.status,
    title: i.indentNumber,
    subtitle: `${i.client} · ${i.route}`,
    meta: i.clientRate ? formatINR(i.clientRate) : undefined,
    href: `/indents/${i.id}`,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Indents Board</h1>
          <p className="text-muted-foreground">Indent lifecycle — status is the single source of truth</p>
        </div>
        <Link
          href="/indents"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm hover:bg-accent"
        >
          <LayoutList className="h-4 w-4" /> List view
        </Link>
      </div>

      <Kanban
        columns={columns}
        items={items}
        endpoint="/api/indents/{id}/lifecycle"
        method="POST"
        bodyKey="status"
        extraBody={{ action: "transition" }}
      />
    </div>
  );
}
