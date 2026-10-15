import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet, Receipt, CreditCard, ArrowRight, ExternalLink } from "lucide-react";
import StatusBadge from "@/components/status-badge";
import { getSessionUser } from "@/lib/auth";
import { getVendorPayments } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { formatINR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorPaymentsPage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login?portal=transporter");

  const [payments, tripAgg] = await Promise.all([
    getVendorPayments(user.vendorId),
    prisma.trip.aggregate({
      where: { vendorId: user.vendorId, status: { notIn: ["CANCELLED", "cancelled"] } },
      _sum: { vendorRate: true },
    }),
  ]);

  const totalReceivable = Number(tripAgg._sum.vendorRate ?? 0);
  const totalAdvanceReceived = payments
    .filter((p) => p.paymentType === "ADVANCE" && p.status === "PAID")
    .reduce((s, p) => s + p.paidAmount, 0);
  const balanceAmount = Math.max(0, totalReceivable - totalAdvanceReceived);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Payments & Settlement
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Track all advance and balance payouts transferred to your registered bank account.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200/60">
          <Receipt className="h-4 w-4" />
          <span>{payments.length} Records</span>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/60">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Receivable</p>
            <p className="text-xl sm:text-2xl font-extrabold text-gray-950 tabular-nums mt-0.5">
              {formatINR(totalReceivable)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/60">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Advance Received</p>
            <p className="text-xl sm:text-2xl font-extrabold text-gray-950 tabular-nums mt-0.5">
              {formatINR(totalAdvanceReceived)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100/60">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance Amount</p>
            <p className="text-xl sm:text-2xl font-extrabold text-gray-950 tabular-nums mt-0.5">
              {formatINR(balanceAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-gray-950">Payment History</h2>
          <span className="text-xs text-gray-500 font-medium">Showing {payments.length} transactions</span>
        </div>

        {payments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 border border-purple-100">
              <Wallet className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-gray-950">No payments recorded yet</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Advance and balance payouts appear here once operations and finance process them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">LR No.</th>
                  <th className="px-6 py-3.5">Route</th>
                  <th className="px-6 py-3.5 text-right">Freight</th>
                  <th className="px-6 py-3.5 text-right">Paid Amount</th>
                  <th className="px-6 py-3.5">Reference / UTR</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 text-gray-500">
                      {p.paidAt ? formatDate(p.paidAt) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700">
                        {p.paymentTypeLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-950">
                      <Link
                        href={`/portal/vendor/trips/${p.tripId}`}
                        className="text-gray-950 hover:text-blue-600 transition-colors"
                      >
                        {p.lrNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{p.route}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900 tabular-nums">
                      {formatINR(p.amount)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 tabular-nums">
                      {formatINR(p.paidAmount)}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {p.referenceNo ?? p.chequeNumber ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {p.voucherUrl && (
                          <a
                            href={p.voucherUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <span>Voucher</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {p.proofUrl && (
                          <a
                            href={p.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            <span>Proof</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {!p.voucherUrl && !p.proofUrl && (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
