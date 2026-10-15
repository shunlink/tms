import { formatINR } from "@/lib/utils";

type Line = {
  lineNumber: number;
  description: string | null;
  quantity: { toString(): string } | number;
  unitAmount: { toString(): string } | number;
  amount: { toString(): string } | number;
  taxAmount: { toString(): string } | number;
};

type NoteDocProps = {
  noteNumber: string;
  noteType: string;
  issueDate: Date | string | null;
  counterpartyName: string;
  counterpartyGstin?: string | null;
  reason?: string | null;
  reference?: string | null;
  lines: Line[];
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxJurisdiction?: string | null;
};

function num(v: { toString(): string } | number) {
  return typeof v === "number" ? v : Number(v);
}

export default function FinancialNoteDocument(props: NoteDocProps) {
  const title = props.noteType === "DEBIT_NOTE" ? "Debit Note" : "Credit Note";
  return (
    <div className="print:p-8 p-6 max-w-3xl mx-auto bg-white text-slate-900">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-500">ShunLink TMS — not a statutory tax document unless finance certifies</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium">Note No.</p>
            <p>{props.noteNumber}</p>
          </div>
          <div>
            <p className="font-medium">Issue date</p>
            <p>{props.issueDate ? new Date(props.issueDate).toLocaleDateString("en-IN") : "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="font-medium">Counterparty</p>
            <p>{props.counterpartyName}</p>
            {props.counterpartyGstin && <p className="text-slate-600">GSTIN: {props.counterpartyGstin}</p>}
          </div>
          {props.reference && (
            <div className="col-span-2">
              <p className="font-medium">Reference</p>
              <p>{props.reference}</p>
            </div>
          )}
          {props.reason && (
            <div className="col-span-2">
              <p className="font-medium">Reason</p>
              <p>{props.reason}</p>
            </div>
          )}
        </div>
      </header>
      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">#</th>
            <th className="text-left py-2">Description</th>
            <th className="text-right py-2">Amount</th>
            <th className="text-right py-2">Tax</th>
          </tr>
        </thead>
        <tbody>
          {props.lines.map((l) => (
            <tr key={l.lineNumber} className="border-b border-slate-100">
              <td className="py-2">{l.lineNumber}</td>
              <td className="py-2">{l.description ?? "—"}</td>
              <td className="py-2 text-right">{formatINR(num(l.amount))}</td>
              <td className="py-2 text-right">{formatINR(num(l.taxAmount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-sm space-y-1 ml-auto max-w-xs">
        <div className="flex justify-between">
          <span>Taxable</span>
          <span>{formatINR(props.taxableAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span>{formatINR(props.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold text-base border-t pt-2">
          <span>Total</span>
          <span>{formatINR(props.totalAmount)}</span>
        </div>
        {props.taxJurisdiction && (
          <p className="text-xs text-slate-500 pt-2">Jurisdiction: {props.taxJurisdiction}</p>
        )}
      </div>
    </div>
  );
}
