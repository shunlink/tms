import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import { Wallet, CreditCard, CheckCircle2, ArrowRight } from "lucide-react";
import DataTable, { type DataColumn } from "@/components/data-table";
import VendorPaymentForm from "@/components/forms/vendor-payment-form";
import { requirePagePermission } from "@/lib/page-auth";
import { listVendorPayments, countVendorPaymentsThisMonth } from "@/lib/services/vendor-payment.service";
import { getFormOptions } from "@/lib/queries";
import { hasPermission } from "@/lib/services/permission.service";
import { formatINR, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import NavBadge from "@/components/nav-badge";
import { getVendorPaymentQueueCounts } from "@/lib/services/work-queues.service";

export const dynamic = "force-dynamic";

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  ADVANCE: "Advance",
  BALANCE: "Balance",
  OTHER: "Other",
};

const columns: DataColumn[] = [
  { key: "paidAtDisplay", header: "Date" },
  { key: "paymentTypeLabel", header: "Type" },
  { key: "vendorName", header: "Vendor" },
  { key: "lrNumber", header: "Trip (LR)", kind: "link", hrefPrefix: "/trips/", idKey: "tripId" },
  { key: "amountDisplay", header: "Freight", align: "right", kind: "money" },
  { key: "netPayableDisplay", header: "Paid", align: "right", kind: "money" },
  { key: "referenceNo", header: "Reference" },
  { key: "status", header: "Status", kind: "badge" },
  { key: "proofLabel", header: "Proof", kind: "external-link", hrefKey: "proofUrl" },
];

export default async function PaymentsPage() {
  const user = await requirePagePermission("payment.view");
  const canManage = user.id ? await hasPermission(user.id, "payment.create") : false;

  const [payments, monthStats, formOptions, queueCounts, trips] = await Promise.all([
    listVendorPayments(),
    countVendorPaymentsThisMonth(),
    getFormOptions(),
    getVendorPaymentQueueCounts(),
    prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        lrNumber: true,
        routeFrom: true,
        routeTo: true,
        vendorId: true,
        vendorRate: true,
      },
    }),
  ]);

  const rows = payments.map((p) => ({
    ...p,
    vendorName: p.vendor.name,
    tripId: p.tripId,
    lrNumber: p.trip.lrNumber,
    route: `${p.trip.routeFrom} → ${p.trip.routeTo}`,
    paidAtDisplay: p.paidAt ? formatDate(p.paidAt) : "—",
    paymentTypeLabel: PAYMENT_TYPE_LABELS[p.paymentType] ?? p.paymentType,
    amountDisplay: p.amount,
    netPayableDisplay: p.netPayable,
    referenceNo: p.referenceNo ?? p.chequeNumber ?? "—",
    proofUrl: p.proof?.url ?? null,
    proofLabel: p.proof?.url ? "View" : "—",
  }));

  const paidTotal = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.netPayable, 0);
  const advanceTotal = payments.filter((p) => p.paymentType === "ADVANCE" && p.status === "PAID").reduce((s, p) => s + p.netPayable, 0);
  const balanceTotal = payments.filter((p) => p.paymentType === "BALANCE" && p.status === "PAID").reduce((s, p) => s + p.netPayable, 0);

  return (
    <div>
      <PageHeader
        title="Vendor Payments"
        description="Vendor payout ledger plus queues for advance and balance settlement — use the cards below to open payable tasks."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={CheckCircle2} value={formatINR(monthStats.total)} label="Paid This Month" />
        <StatCard icon={CreditCard} value={formatINR(advanceTotal)} label="Advances Paid" />
        <StatCard icon={Wallet} value={formatINR(balanceTotal)} label="Balance Paid" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Link
          href="/advance-payments"
          className="flex items-center justify-between gap-3 rounded-lg border bg-white p-4 hover:border-blue-300 transition-colors"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-900">Advance Payment Queue</p>
              <NavBadge count={queueCounts.advances} className="ml-0" />
            </div>
            <p className="text-sm text-slate-500">
              {queueCounts.advances > 0
                ? `${queueCounts.advances} request${queueCounts.advances === 1 ? "" : "s"} awaiting finance action`
                : "Approve and process trip advance requests"}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>
        <Link
          href="/balance-payments"
          className="flex items-center justify-between gap-3 rounded-lg border bg-white p-4 hover:border-blue-300 transition-colors"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-900">Balance Payment Queue</p>
              <NavBadge count={queueCounts.balancePayments} className="ml-0" />
            </div>
            <p className="text-sm text-slate-500">
              {queueCounts.balancePayments > 0
                ? `${queueCounts.balancePayments} balance task${queueCounts.balancePayments === 1 ? "" : "s"} awaiting finance action`
                : "Review and settle post-POD vendor balances"}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>
      </div>

      {canManage && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-slate-500">Loading form...</p>}>
              <VendorPaymentForm
                vendors={formOptions.vendors.map((v) => ({ id: v.id, label: v.name }))}
                trips={trips.map((t) => ({
                  id: t.id,
                  lrNumber: t.lrNumber,
                  route: `${t.routeFrom} → ${t.routeTo}`,
                  vendorId: t.vendorId,
                  vendorRate: Number(t.vendorRate),
                }))}
              />
            </Suspense>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment Ledger ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={rows as unknown as Record<string, unknown>[]}
            columns={columns}
            searchKeys={["vendorName", "lrNumber", "paymentTypeLabel", "referenceNo"]}
            exportName="vendor-payments"
            emptyText="No vendor payments recorded yet."
          />
          <p className="text-xs text-slate-400 mt-4">
            Total paid (all time): {formatINR(paidTotal)} · {monthStats.count} payments this month
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
