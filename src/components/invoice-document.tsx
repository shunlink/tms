import { formatINR, formatDate } from "@/lib/utils";
import type { InvoicePrintSnapshot } from "@/lib/services/invoice-document.service";

export type InvoicePaymentRow = {
  id: string;
  amount: number;
  paidAt: Date | string;
  paymentMode: string | null;
  referenceNo: string | null;
  chequeNumber: string | null;
  recordedBy: { name: string | null } | null;
};

export default function InvoiceDocument({
  html,
  snapshot,
  payments,
}: {
  html: string;
  snapshot: InvoicePrintSnapshot;
  payments?: InvoicePaymentRow[];
}) {
  const balance = snapshot.totalAmount - snapshot.paidAmount;

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg overflow-hidden print:border-0 print:rounded-none">
        <iframe
          title={`Tax invoice ${snapshot.invoiceNumber}`}
          srcDoc={html}
          className="w-full border-0 min-h-[720px] print:min-h-0"
          style={{ height: "min(90vh, 820px)" }}
        />
      </div>

      {(snapshot.paidAmount > 0 || balance > 0) && (
        <div className="flex justify-end print:hidden">
          <div className="w-64 space-y-2 text-sm border rounded-lg p-4 bg-slate-50">
            {snapshot.paidAmount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Paid</span>
                <span>{formatINR(snapshot.paidAmount)}</span>
              </div>
            )}
            {balance > 0 && (
              <div className="flex justify-between font-semibold text-amber-700">
                <span>Balance due</span>
                <span>{formatINR(balance)}</span>
              </div>
            )}
            <p className="text-xs text-slate-500">Status: {snapshot.status.replace(/_/g, " ")}</p>
          </div>
        </div>
      )}

      {payments && payments.length > 0 && (
        <div className="border rounded-lg p-6 bg-white print:hidden">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment history</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 font-medium">Reference</th>
                <th className="pb-2 font-medium">Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2">{formatDate(p.paidAt)}</td>
                  <td className="py-2">{formatINR(p.amount)}</td>
                  <td className="py-2">{p.paymentMode ?? "—"}</td>
                  <td className="py-2">{p.referenceNo ?? p.chequeNumber ?? "—"}</td>
                  <td className="py-2">{p.recordedBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
