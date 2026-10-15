import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type DataColumn } from "@/components/data-table";
import PageHeader from "@/components/page-header";
import { formatInrMinor } from "@/components/accounting/money-cells";
import { listPostedAccountActivity } from "@/lib/accounting/gl-balances.service";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-auth";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const columns: DataColumn[] = [
  { key: "accountingDate", header: "Date", kind: "date" },
  { key: "journalNumber", header: "Journal", kind: "link", hrefPrefix: "/accounting/journals/", idKey: "journalEntryId" },
  { key: "sourceType", header: "Source" },
  { key: "description", header: "Description" },
  { key: "debit", header: "Debit" },
  { key: "credit", header: "Credit" },
];

type Params = { params: { code: string } };

export default async function AccountActivityPage({ params }: Params) {
  await requirePagePermission("accounting.report.view");
  const account = await prisma.chartOfAccount.findUnique({ where: { code: params.code } });
  if (!account) notFound();

  const { items } = await listPostedAccountActivity({
    accountCode: params.code,
    limit: 100,
    offset: 0,
  });

  const rows = items.map((l) => ({
    id: l.id,
    journalEntryId: l.journalEntryId,
    accountingDate: l.accountingDate,
    journalNumber: l.journalNumber,
    sourceType: l.sourceType,
    description: l.description ?? "—",
    debit: l.debitMinor ? formatInrMinor(l.debitMinor) : "—",
    credit: l.creditMinor ? formatInrMinor(l.creditMinor) : "—",
  }));

  return (
    <div>
      <PageHeader
        title={`${account.code} — ${account.name}`}
        description="Posted journal lines (drill-down)"
      />
      <Card>
        <CardHeader>
          <CardTitle>Activity ({items.length} shown)</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} pageSize={25} />
        </CardContent>
      </Card>
    </div>
  );
}
