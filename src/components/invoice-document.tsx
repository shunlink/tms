import { companyProfile } from "@/lib/company";
import { formatINR, formatDate } from "@/lib/utils";

export type InvoiceData = {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | null;
  status: string;
  subTotal: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  client: {
    name: string;
    gstin: string | null;
    address: string | null;
    phone: string | null;
    email?: string | null;
  };
  trips: {
    id: string;
    lrNumber: string;
    route: string;
    clientRate: number;
    gstRate?: number | null;
    gstAmount?: number | null;
  }[];
  payments?: {
    id: string;
    amount: number;
    paidAt: Date | string;
    paymentMode: string | null;
    referenceNo: string | null;
    chequeNumber: string | null;
    recordedBy: { name: string | null } | null;
  }[];
};

export default function InvoiceDocument({ inv }: { inv: InvoiceData }) {
  const balance = inv.totalAmount - inv.paidAmount;

  return (
    <div className="bg-white border rounded-lg p-8 print:border-0 print:p-0">
      <div className="flex justify-between items-start border-b pb-6 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{companyProfile.name}</h1>
          <p className="text-sm text-slate-600 mt-1">{companyProfile.address}</p>
          <p className="text-sm text-slate-600">GSTIN: {companyProfile.gstin}</p>
          <p className="text-sm text-slate-600">PAN: {companyProfile.pan}</p>
          <p className="text-sm text-slate-600">{companyProfile.phone} · {companyProfile.email}</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-slate-900">TAX INVOICE</h2>
          <p className="text-sm text-slate-600 mt-2">
            Invoice No: <span className="font-medium text-slate-900">{inv.invoiceNumber}</span>
          </p>
          <p className="text-sm text-slate-600">Date: {formatDate(inv.issueDate)}</p>
          <p className="text-sm text-slate-600">Due: {formatDate(inv.dueDate)}</p>
          <p className="text-sm mt-2">
            Status: <span className="font-medium">{inv.status.replace(/_/g, " ")}</span>
          </p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Bill To</p>
        <p className="font-medium text-slate-900">{inv.client.name}</p>
        {inv.client.address && <p className="text-sm text-slate-600">{inv.client.address}</p>}
        {inv.client.gstin && <p className="text-sm text-slate-600">GSTIN: {inv.client.gstin}</p>}
        {inv.client.phone && <p className="text-sm text-slate-600">{inv.client.phone}</p>}
        {inv.client.email && <p className="text-sm text-slate-600">{inv.client.email}</p>}
      </div>

      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-y bg-slate-50 text-left text-slate-600">
            <th className="py-2 px-2 font-medium">#</th>
            <th className="py-2 px-2 font-medium">LR No.</th>
            <th className="py-2 px-2 font-medium">Route</th>
            <th className="py-2 px-2 font-medium text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.trips.map((t, i) => (
            <tr key={t.id} className="border-b">
              <td className="py-2 px-2 text-slate-500">{i + 1}</td>
              <td className="py-2 px-2 font-medium text-slate-900">{t.lrNumber}</td>
              <td className="py-2 px-2 text-slate-700">{t.route}</td>
              <td className="py-2 px-2 text-right text-slate-900">{formatINR(t.clientRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Freight Subtotal</span>
            <span className="text-slate-900">{formatINR(inv.subTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">GST</span>
            <span className="text-slate-900">{formatINR(inv.gstAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Total</span>
            <span>{formatINR(inv.totalAmount)}</span>
          </div>
          {inv.paidAmount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Paid</span>
              <span>{formatINR(inv.paidAmount)}</span>
            </div>
          )}
          {balance > 0 && (
            <div className="flex justify-between font-semibold text-amber-700">
              <span>Balance Due</span>
              <span>{formatINR(balance)}</span>
            </div>
          )}
        </div>
      </div>

      {inv.payments && inv.payments.length > 0 && (
        <div className="mt-8 border-t pt-6 print:hidden">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment History</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 font-medium">Reference</th>
                <th className="pb-2 font-medium">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {inv.payments.map((p) => (
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
