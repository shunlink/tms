import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type DataColumn } from "@/components/data-table";
import PageHeader from "@/components/page-header";
import { listJournals } from "@/lib/accounting/posting.service";
import { requirePagePermission } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  DRAFT: "muted",
  POSTED: "success",
  REVERSED: "warning",
};

const columns: DataColumn[] = [
  { key: "journalNumber", header: "Journal #", kind: "link", hrefPrefix: "/accounting/journals/" },
  { key: "accountingDate", header: "Date", kind: "date" },
  { key: "sourceType", header: "Source" },
  { key: "description", header: "Memo" },
  { key: "status", header: "Status", kind: "badge", tones: statusTones },
];

export default async function JournalsPage() {
  await requirePagePermission("accounting.journal.view");
  const { items } = await listJournals({ limit: 100 });

  const rows = items.map((j) => ({
    id: j.id,
    journalNumber: j.journalNumber,
    accountingDate: j.accountingDate,
    sourceType: j.sourceType,
    description: j.description ?? "—",
    status: j.status,
  }));

  return (
    <div>
      <PageHeader title="Journal Register" description="Posted and draft general-ledger journals" />
      <Card>
        <CardHeader>
          <CardTitle>Journals ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} />
          <p className="text-xs text-slate-500 mt-4">
            Manual journals can be created via API with <code className="text-xs">accounting.journal.draft</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
