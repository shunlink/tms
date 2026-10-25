import type { CompanyProfile } from "@/lib/company";
import type { AdvanceVoucherData } from "@/lib/services/advance-voucher.service";
import { formatINR, formatDate } from "@/lib/utils";
import PrintButton from "@/components/print-button";

export default function AdvancePaymentVoucherDocument({
  data,
  company,
  paymentProofUrl,
}: {
  data: AdvanceVoucherData;
  company: CompanyProfile;
  paymentProofUrl?: string | null;
}) {
  const route = `${data.routeFrom} → ${data.routeTo}`;

  return (
    <div>
      <div className="mb-4 print:hidden flex flex-wrap gap-2">
        <PrintButton />
        {paymentProofUrl && (
          <a
            href={paymentProofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            View Payment Proof
          </a>
        )}
      </div>

      <div className="bg-white border rounded-lg p-8 print:border-0 print:p-0">
        <div className="flex justify-between items-start border-b pb-6 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
            <p className="text-sm text-slate-600 mt-1">{company.address}</p>
            <p className="text-sm text-slate-600">GSTIN: {company.gstin} · PAN: {company.pan}</p>
            <p className="text-sm text-slate-600">{company.phone} · {company.email}</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-slate-900">ADVANCE PAYMENT VOUCHER</h2>
            <p className="text-sm text-slate-600 mt-2">
              Voucher No: <span className="font-medium text-slate-900">{data.voucherNumber}</span>
            </p>
            <p className="text-sm text-slate-600">
              Advance ID: <span className="font-medium text-slate-900">{data.requestNumber}</span>
            </p>
            <p className="text-sm text-slate-600">Date: {formatDate(data.processedAt)}</p>
            <p className="text-sm font-semibold text-green-700 mt-2">Status: {data.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Vendor / Transporter</p>
            <p className="font-medium">{data.vendorName}</p>
            {data.vendorGstin && <p className="text-slate-600">GSTIN: {data.vendorGstin}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Trip (LR)</p>
            <p className="font-medium">{data.tripLrNumber}</p>
            <p className="text-slate-600">Trip ID: {data.tripId}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Indent</p>
            <p className="font-medium">{data.indentNumber ?? "—"}</p>
            {data.indentId && <p className="text-slate-600">Indent ID: {data.indentId}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Route</p>
            <p className="font-medium">{route}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-y bg-slate-50 text-left text-slate-600">
              <th className="py-2 px-2 font-medium">Description</th>
              <th className="py-2 px-2 font-medium text-right">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-2 px-2">Freight amount</td><td className="py-2 px-2 text-right">{formatINR(data.freightAmount)}</td></tr>
            <tr className="border-b"><td className="py-2 px-2">Advance requested</td><td className="py-2 px-2 text-right">{formatINR(data.requestedAmount)}</td></tr>
            {data.negotiatedAmount != null && (
              <tr className="border-b"><td className="py-2 px-2">Negotiated advance</td><td className="py-2 px-2 text-right">{formatINR(data.negotiatedAmount)}</td></tr>
            )}
            {data.approvedAmount != null && (
              <tr className="border-b"><td className="py-2 px-2">Approved advance</td><td className="py-2 px-2 text-right">{formatINR(data.approvedAmount)}</td></tr>
            )}
            <tr><td className="py-2 px-2 font-semibold">Amount actually paid</td><td className="py-2 px-2 text-right font-semibold">{formatINR(data.paidAmount)}</td></tr>
          </tbody>
        </table>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-slate-500">Payment Method</p><p className="font-medium">{data.paymentMethod}</p></div>
          <div><p className="text-xs text-slate-500">Payment Date</p><p className="font-medium">{formatDate(data.paymentDate)}</p></div>
          <div><p className="text-xs text-slate-500">UTR / Reference</p><p className="font-medium">{data.utrReference}</p></div>
          <div><p className="text-xs text-slate-500">Bank / Account Used</p><p className="font-medium">{data.bankAccountUsed ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Processed By</p><p className="font-medium">{data.processedByName ?? "Finance Team"}</p></div>
          <div><p className="text-xs text-slate-500">Processed At</p><p className="font-medium">{formatDate(data.processedAt)}</p></div>
        </div>

        <p className="text-xs text-slate-500 mt-8 border-t pt-4">
          This is a system-generated advance payment voucher from {company.name}.
        </p>
      </div>
    </div>
  );
}
