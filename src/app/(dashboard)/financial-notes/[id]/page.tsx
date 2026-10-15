import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/status-badge";
import { formatINR } from "@/lib/utils";
import { getFinancialNote } from "@/lib/services/financial-note.service";
import { requirePagePermission } from "@/lib/page-auth";
import FinancialNoteActions from "@/components/forms/financial-note-actions";
import FinancialNoteDocument from "@/components/financial-note-document";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";

function n(v: { toNumber(): number } | number) {
  return typeof v === "number" ? v : v.toNumber();
}

export default async function FinancialNoteDetailPage({ params }: { params: { id: string } }) {
  await requirePagePermission("financial_note.view");
  const note = await getFinancialNote(params.id);
  if (!note) notFound();

  const counterpartyName = note.vendor?.name ?? note.client?.name ?? "—";
  const reference = [
    note.trip?.lrNumber ? `LR ${note.trip.lrNumber}` : null,
    note.clientInvoice?.invoiceNumber ? `Invoice ${note.clientInvoice.invoiceNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <PageHeader
        title={note.noteNumber ?? "Draft note"}
        description={`${note.noteType.replace("_", " ")} · ${note.businessPurpose}`}
        action={
          <div className="flex gap-2 items-center">
            {note.status === "ISSUED" && <PrintButton />}
            <FinancialNoteActions noteId={note.id} status={note.status} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              Status: <StatusBadge status={note.status} />
            </p>
            <p>Counterparty: {counterpartyName}</p>
            <p>Payable effect: {note.payableEffect}</p>
            <p>Total: {formatINR(n(note.totalAmount))}</p>
            {note.tripChargeId && (
              <p className="text-slate-600">Linked trip charge: {note.tripChargeId}</p>
            )}
            {note.issuedJournal && (
              <p>
                Journal:{" "}
                <Link className="text-blue-600 underline" href={`/accounting/journals/${note.issuedJournal.id}`}>
                  {note.issuedJournal.journalNumber}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
          </CardHeader>
          <CardContent className="text-sm max-h-64 overflow-y-auto space-y-2">
            {note.events.map((e) => {
              const actorName =
                "actor" in e && e.actor && typeof e.actor === "object" && "name" in e.actor
                  ? String((e.actor as { name?: string }).name)
                  : null;
              return (
              <div key={e.id} className="border-b border-slate-100 pb-2">
                <p className="font-medium">{e.action}</p>
                <p className="text-slate-500 text-xs">
                  {new Date(e.createdAt).toLocaleString("en-IN")}
                  {actorName ? ` · ${actorName}` : ""}
                </p>
                {e.reason && <p className="text-slate-600">{e.reason}</p>}
              </div>
            );
            })}
          </CardContent>
        </Card>
      </div>

      {note.status === "ISSUED" && note.noteNumber && (
        <div className="print:block border rounded-lg overflow-hidden">
          <FinancialNoteDocument
            noteNumber={note.noteNumber}
            noteType={note.noteType}
            issueDate={note.issueDate}
            counterpartyName={counterpartyName}
            counterpartyGstin={note.vendor?.gstin ?? note.client?.gstin}
            reason={note.reason}
            reference={reference || null}
            lines={note.lines}
            taxableAmount={n(note.taxableAmount)}
            taxAmount={n(note.taxAmount)}
            totalAmount={n(note.totalAmount)}
            taxJurisdiction={note.taxJurisdiction}
          />
        </div>
      )}
    </div>
  );
}
