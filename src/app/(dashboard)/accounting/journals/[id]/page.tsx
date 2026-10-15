import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import { getJournalById } from "@/lib/accounting/posting.service";
import { requirePagePermission } from "@/lib/page-auth";
import { formatINR } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function minorToInr(minor: number) {
  return formatINR(minor / 100);
}

export default async function JournalDetailPage({ params }: { params: { id: string } }) {
  await requirePagePermission("accounting.journal.view");
  const journal = await getJournalById(params.id);
  if (!journal) notFound();

  return (
    <div>
      <PageHeader
        title={journal.journalNumber}
        description={journal.description ?? journal.sourceType}
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status <StatusBadge status={journal.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Accounting date: {new Date(journal.accountingDate).toLocaleDateString()}</p>
          <p>Source: {journal.sourceType}{journal.sourceId ? ` · ${journal.sourceId}` : ""}</p>
          <p>Currency: {journal.currency}</p>
          {journal.postedAt && <p>Posted: {new Date(journal.postedAt).toLocaleString()}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">Account</th>
                <th className="py-2 text-right">Debit</th>
                <th className="py-2 text-right">Credit</th>
                <th className="py-2">Memo</th>
              </tr>
            </thead>
            <tbody>
              {journal.lines.map((line) => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2">
                    {line.account.code} — {line.account.name}
                  </td>
                  <td className="py-2 text-right">{line.debitMinor ? minorToInr(line.debitMinor) : "—"}</td>
                  <td className="py-2 text-right">{line.creditMinor ? minorToInr(line.creditMinor) : "—"}</td>
                  <td className="py-2 text-slate-600">{line.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/accounting/journals" className="text-blue-600 text-sm hover:underline mt-4 inline-block">
            ← Journal register
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
