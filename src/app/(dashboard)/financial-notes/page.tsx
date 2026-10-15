import Link from "next/link";
import PageHeader from "@/components/page-header";
import DataTable, { type DataColumn } from "@/components/data-table";
import StatusBadge from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listFinancialNotes } from "@/lib/services/financial-note.service";
import { requirePagePermission } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  DRAFT: "muted",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  ISSUED: "success",
  REJECTED: "danger",
  VOIDED: "muted",
  REVERSED: "default",
};

const columns: DataColumn[] = [
  { key: "noteNumber", header: "Note No.", kind: "link", hrefPrefix: "/financial-notes/" },
  { key: "noteType", header: "Type" },
  { key: "counterparty", header: "Counterparty" },
  { key: "totalAmount", header: "Total", align: "right", kind: "money" },
  { key: "status", header: "Status", kind: "badge", tones: statusTones },
  { key: "createdAt", header: "Created", kind: "date" },
];

export default async function FinancialNotesPage() {
  await requirePagePermission("financial_note.view");
  const notes = await listFinancialNotes();
  const rows = notes.map((n) => ({
    id: n.id,
    noteNumber: n.noteNumber ?? `(draft) ${n.id.slice(0, 8)}`,
    noteType: n.noteType.replace("_", " "),
    counterparty: n.vendor?.name ?? n.client?.name ?? "—",
    totalAmount: typeof n.totalAmount === "number" ? n.totalAmount : n.totalAmount.toNumber(),
    status: n.status,
    createdAt: n.createdAt,
  }));

  return (
    <div>
      <PageHeader
        title="Debit / Credit Notes"
        description="Formal commercial adjustments with controlled issuance and accounting"
        action={
          <Link href="/financial-notes/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New note
            </Button>
          </Link>
        }
      />
      <DataTable columns={columns} rows={rows} emptyText="No notes yet" />
    </div>
  );
}
