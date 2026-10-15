import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Receipt,
  Wallet,
  Clock,
  CheckCircle2,
  ArrowRight,
  Inbox,
  FileText,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getClientInvoices } from "@/lib/queries";
import { formatINR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientInvoicesPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login?portal=client");

  const invoices = await getClientInvoices(user.clientId);

  const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
  const totalOutstanding = invoices
    .filter((i) => ["SENT", "UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(i.status))
    .reduce((s, i) => s + ((Number(i.totalAmount) || 0) - (Number(i.paidAmount) || 0)), 0);
  const paidCount = invoices.filter((i) => ["PAID", "SETTLED"].includes(i.status)).length;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight leading-tight">
            Invoices & Billing
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Review your freight invoices, GST tax breakdowns, and payment statuses
          </p>
        </div>
      </div>

      {/* =========================================================================
          METRICS CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Outstanding Balance */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Outstanding Balance</p>
              <p className="text-2xl font-extrabold text-gray-950 mt-0.5">
                {formatINR(totalOutstanding)}
              </p>
            </div>
          </div>
        </div>

        {/* Total Invoiced */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Invoiced</p>
              <p className="text-2xl font-extrabold text-gray-950 mt-0.5">
                {formatINR(totalInvoiced)}
              </p>
            </div>
          </div>
        </div>

        {/* Paid Invoices */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Paid Invoices</p>
              <p className="text-2xl font-extrabold text-gray-950 mt-0.5">{paidCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INVOICES TABLE CARD
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-950">
              All Invoices ({invoices.length})
            </h2>
            <p className="text-xs text-gray-500">
              Statement of accounts and statutory tax invoices
            </p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-xl bg-gray-50/60 border border-dashed border-gray-200">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-[#D97706] flex items-center justify-center mx-auto mb-3">
              <Inbox className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">No invoices yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Invoices are generated after shipments are delivered and proof of delivery is verified.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-5 sm:px-6">Invoice Number</th>
                  <th className="py-3 px-3 text-right">Trips</th>
                  <th className="py-3 px-3 text-right">Freight (₹)</th>
                  <th className="py-3 px-3 text-right">GST (₹)</th>
                  <th className="py-3 px-3 text-right">Total (₹)</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-5 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {invoices.map((i) => {
                  let badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                  if (i.status === "PAID" || i.status === "SETTLED") {
                    badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  } else if (i.status === "OVERDUE") {
                    badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
                  } else if (i.status === "PARTIALLY_PAID") {
                    badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                  } else if (i.status === "CANCELLED") {
                    badgeColor = "bg-gray-100 text-gray-600 border-gray-200";
                  }

                  return (
                    <tr key={i.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Invoice No. */}
                      <td className="py-3.5 px-5 sm:px-6 font-semibold text-gray-900">
                        <Link
                          href={`/portal/client/invoices/${i.id}`}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                        >
                          <Receipt className="h-4 w-4 text-gray-400 shrink-0" />
                          <span>{i.invoiceNumber}</span>
                        </Link>
                      </td>

                      {/* Trips */}
                      <td className="py-3.5 px-3 text-right text-gray-700 tabular-nums">
                        {i.trips}
                      </td>

                      {/* Freight */}
                      <td className="py-3.5 px-3 text-right font-mono text-gray-600 tabular-nums">
                        {formatINR(i.subTotal)}
                      </td>

                      {/* GST */}
                      <td className="py-3.5 px-3 text-right font-mono text-gray-500 tabular-nums">
                        {formatINR(i.gstAmount)}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-gray-950 tabular-nums">
                        {formatINR(i.totalAmount)}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-3 text-gray-600">
                        {formatDate(i.dueDate)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeColor}`}
                        >
                          {i.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-5 sm:px-6 text-right">
                        <Link
                          href={`/portal/client/invoices/${i.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <span>View</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
