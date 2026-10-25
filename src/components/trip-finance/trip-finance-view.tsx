import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  IndianRupee,
  Receipt,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import type { TripFinanceDto } from "@/lib/services/trip-finance.service";
import { formatDate, formatINR } from "@/lib/utils";

function AmountRow({
  label,
  amount,
  className,
  emphasize,
}: {
  label: string;
  amount: number | null | undefined;
  className?: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 text-sm border-b last:border-0 ${className ?? ""}`}>
      <span className="text-slate-600">{label}</span>
      <span className={emphasize ? "font-semibold text-slate-900" : "font-medium text-slate-900"}>
        {amount != null ? formatINR(amount) : "—"}
      </span>
    </div>
  );
}

function PaymentHistoryTable({ payments }: { payments: TripFinanceDto["vendorSettlement"]["paymentHistory"] }) {
  if (payments.length === 0) {
    return <p className="text-sm text-slate-500 py-2">No payments recorded</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Reference</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="py-2 pr-4">{formatDate(p.paidAt)}</td>
              <td className="py-2 pr-4">{p.paymentType?.replace(/_/g, " ") ?? "—"}</td>
              <td className="py-2 pr-4 font-medium">{formatINR(p.amount)}</td>
              <td className="py-2 pr-4 text-slate-600">{p.referenceNo ?? p.paymentMode ?? "—"}</td>
              <td className="py-2">
                {p.status ? <StatusBadge status={p.status} className="text-xs" /> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{title}</h4>
      <div className="rounded-lg border bg-slate-50/50 px-4">{children}</div>
    </div>
  );
}

export default function TripFinanceView({ finance }: { finance: TripFinanceDto }) {
  const { trip, commercialSummary, financialBreakdown, vendorSettlement, customerSettlement, profitability, timeline, documents } =
    finance;

  return (
    <div className="w-full max-w-6xl mx-auto">
      <Link
        href={`/trips/${trip.id}`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Trip
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Trip Finance</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
            <Truck className="h-4 w-4 text-slate-400" />
            {trip.lrNumber}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-slate-400" />
            {trip.client.name}
          </span>
          {trip.vendor && (
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-slate-400" />
              {trip.vendor.name}
            </span>
          )}
          <span>
            {trip.routeFrom} → {trip.routeTo}
          </span>
          {trip.indent && (
            <Link href={`/indents/${trip.indent.id}`} className="text-blue-600 hover:underline">
              {trip.indent.indentNumber}
            </Link>
          )}
          <StatusBadge status={trip.status} className="text-xs" />
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Commercial Summary</CardTitle>
          <p className="text-xs text-slate-500">
            Sell rate is freight only. Loading and unloading are client charges; receivables use the invoiced trip
            total when billed.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Sell rate (freight)</p>
              <p className="text-lg font-semibold">{formatINR(commercialSummary.sellRate)}</p>
            </div>
            <div>
              <p className="text-slate-500">Client loading</p>
              <p className="text-lg font-semibold">{formatINR(commercialSummary.customerLoadingCharge)}</p>
            </div>
            <div>
              <p className="text-slate-500">Client unloading</p>
              <p className="text-lg font-semibold">{formatINR(commercialSummary.customerUnloadingCharge)}</p>
            </div>
            <div>
              <p className="text-slate-500">Total billable (pre-invoice)</p>
              <p className="text-lg font-semibold">{formatINR(commercialSummary.customerBillableTotal)}</p>
            </div>
            <div>
              <p className="text-slate-500">Buy Rate</p>
              <p className="text-lg font-semibold">{formatINR(commercialSummary.buyRate)}</p>
            </div>
            <div>
              <p className="text-slate-500">Expected Margin</p>
              <p className="text-lg font-semibold text-emerald-700">
                {formatINR(commercialSummary.expectedMargin)}
                <span className="text-xs text-slate-500 ml-1">
                  ({commercialSummary.expectedMarginPercent.toFixed(1)}%)
                </span>
              </p>
            </div>
            <div>
              <p className="text-slate-500">Vendor Advance</p>
              <p className="text-lg font-semibold">{formatINR(commercialSummary.vendorAdvance)}</p>
            </div>
            <div>
              <p className="text-slate-500">Vendor Balance</p>
              <p className="text-lg font-semibold">{formatINR(commercialSummary.vendorBalance)}</p>
            </div>
            <div>
              <p className="text-slate-500">Invoiced trip total</p>
              <p className="text-lg font-semibold">
                {commercialSummary.customerInvoice != null
                  ? formatINR(commercialSummary.customerInvoice)
                  : "Not invoiced"}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Freight + loading + unloading on invoice</p>
            </div>
            <div>
              <p className="text-slate-500">Customer Receivable</p>
              <p className="text-lg font-semibold text-amber-700">
                {formatINR(commercialSummary.customerReceivable)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Customer Collected</p>
              <p className="text-lg font-semibold text-emerald-700">
                {formatINR(commercialSummary.customerCollected)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Vendor Outstanding</p>
              <p className="text-lg font-semibold text-red-700">
                {formatINR(commercialSummary.vendorOutstanding)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard icon={IndianRupee} value={formatINR(commercialSummary.sellRate)} label="Freight (sell)" />
        <StatCard icon={Wallet} value={formatINR(commercialSummary.buyRate)} label="Buy" />
        <StatCard
          icon={TrendingUp}
          value={formatINR(commercialSummary.expectedMargin)}
          label="Expected Margin"
          className="text-emerald-700"
        />
        <StatCard
          icon={Receipt}
          value={formatINR(commercialSummary.customerReceivable)}
          label="Customer Receivable"
          className="text-amber-700"
        />
        <StatCard
          icon={Wallet}
          value={formatINR(commercialSummary.vendorOutstanding)}
          label="Vendor Payable"
          className="text-red-700"
        />
        <StatCard
          icon={IndianRupee}
          value={formatINR(commercialSummary.customerCollected)}
          label="Cash Collected"
          className="text-emerald-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Receivable</CardTitle>
          </CardHeader>
          <CardContent>
            {!customerSettlement.invoiced ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Not invoiced</p>
                <AmountRow label="Freight (sell rate)" amount={customerSettlement.customerFreight} />
                <AmountRow label="Loading (client)" amount={customerSettlement.customerLoadingCharge} />
                <AmountRow label="Unloading (client)" amount={customerSettlement.customerUnloadingCharge} />
                <AmountRow
                  label="Expected billable total"
                  amount={
                    customerSettlement.customerFreight +
                    customerSettlement.customerLoadingCharge +
                    customerSettlement.customerUnloadingCharge
                  }
                  emphasize
                />
                {customerSettlement.invoiceTaskId ? (
                  <Link href="/invoice-tasks" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                    View invoice tasks <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <Link href="/invoices" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                    Go to invoices <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            ) : customerSettlement.invoiceStatus === "DRAFT" ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Draft invoice{" "}
                  {customerSettlement.invoiceId && (
                    <Link href={`/invoices/${customerSettlement.invoiceId}`} className="text-blue-600 hover:underline">
                      {customerSettlement.invoiceNumber}
                    </Link>
                  )}
                </p>
                <p className="text-xs text-slate-500">Draft invoices are not included in receivables until finalized.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <AmountRow label="Invoice number" amount={null} />
                <p className="text-sm font-medium pb-2">
                  {customerSettlement.invoiceId ? (
                    <Link href={`/invoices/${customerSettlement.invoiceId}`} className="text-blue-600 hover:underline">
                      {customerSettlement.invoiceNumber}
                    </Link>
                  ) : (
                    customerSettlement.invoiceNumber
                  )}
                </p>
                <AmountRow label="Invoice date" amount={null} />
                <p className="text-sm font-medium pb-2 border-b">{formatDate(customerSettlement.invoiceDate)}</p>
                <AmountRow label="Due date" amount={null} />
                <p className="text-sm font-medium pb-2 border-b">{formatDate(customerSettlement.dueDate)}</p>
                <div className="flex items-center justify-between py-2 text-sm border-b">
                  <span className="text-slate-600">Status</span>
                  {customerSettlement.displayStatus ? (
                    <StatusBadge status={customerSettlement.displayStatus} className="text-xs" />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <AmountRow label="Freight" amount={customerSettlement.customerFreight} />
                <AmountRow label="Loading (client)" amount={customerSettlement.customerLoadingCharge} />
                <AmountRow label="Unloading (client)" amount={customerSettlement.customerUnloadingCharge} />
                <AmountRow label="Invoice total (trip)" amount={customerSettlement.invoiceTotal} emphasize />
                <AmountRow label="Amount collected" amount={customerSettlement.amountCollected} />
                <AmountRow label="Outstanding" amount={customerSettlement.outstanding} emphasize />
                {customerSettlement.ageingDays != null && customerSettlement.ageingDays > 0 && (
                  <p className="text-xs text-red-600 pt-1">{customerSettlement.ageingDays} days overdue</p>
                )}
              </div>
            )}
            {customerSettlement.paymentHistory.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Payment History</p>
                <PaymentHistoryTable payments={customerSettlement.paymentHistory} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Vendor Payable</CardTitle>
            <div className="flex gap-2 text-xs">
              <Link href="/advance-payments" className="text-blue-600 hover:underline">Advances</Link>
              <Link href="/balance-payments" className="text-blue-600 hover:underline">Balance</Link>
              <Link href="/payments" className="text-blue-600 hover:underline">Payments</Link>
            </div>
          </CardHeader>
          <CardContent>
            {!vendorSettlement.hasVendor ? (
              <p className="text-sm text-slate-500">No vendor allocated</p>
            ) : (
              <div>
                <AmountRow label="Buy / Freight" amount={vendorSettlement.freight} />
                <AmountRow label="Additional charges" amount={vendorSettlement.additionalCharges} />
                <AmountRow label="Deductions" amount={vendorSettlement.deductions} />
                <AmountRow label="Gross payable" amount={vendorSettlement.grossPayable} emphasize />
                <AmountRow label="TDS withheld" amount={vendorSettlement.tdsAmount} />
                <AmountRow label="Final payable" amount={vendorSettlement.finalPayable} emphasize />
                <AmountRow label="Advance approved" amount={vendorSettlement.advanceApproved} />
                <AmountRow label="Advance paid" amount={vendorSettlement.advancePaid} />
                <AmountRow label="Advance outstanding" amount={vendorSettlement.advanceOutstanding} />
                <AmountRow label="Balance amount" amount={vendorSettlement.balanceAmount} />
                <AmountRow label="Balance paid" amount={vendorSettlement.balancePaid} />
                <AmountRow label="Vendor outstanding" amount={vendorSettlement.vendorOutstanding} emphasize />
                {vendorSettlement.balanceTaskStatus && (
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-xs text-slate-500">Balance task</span>
                    <StatusBadge status={vendorSettlement.balanceTaskStatus} className="text-xs" />
                  </div>
                )}
              </div>
            )}
            {vendorSettlement.paymentHistory.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Payment History</p>
                <PaymentHistoryTable payments={vendorSettlement.paymentHistory} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Trip Financial Breakdown</CardTitle>
          <p className="text-xs text-slate-500">Read-only settlement view — not a statutory general ledger</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <BreakdownSection title="Revenue (client)">
              <AmountRow label="Freight (sell rate)" amount={financialBreakdown.revenue.customerFreight} />
              <AmountRow label="Loading charge" amount={financialBreakdown.revenue.customerLoadingCharge} />
              <AmountRow label="Unloading charge" amount={financialBreakdown.revenue.customerUnloadingCharge} />
              <AmountRow
                label="Total billable (pre-invoice)"
                amount={financialBreakdown.revenue.customerBillableTotal}
                emphasize
              />
            </BreakdownSection>
            <BreakdownSection title="Vendor Cost">
              <AmountRow label="Base freight / buy rate" amount={financialBreakdown.vendorCost.baseFreight} />
              <AmountRow label="Additional charges" amount={financialBreakdown.vendorCost.additionalCharges} />
              <AmountRow label="Deductions" amount={financialBreakdown.vendorCost.deductions} />
              <AmountRow label="TDS" amount={financialBreakdown.vendorCost.tds} />
            </BreakdownSection>
            <BreakdownSection title="Vendor Settlement">
              <AmountRow label="Gross payable" amount={financialBreakdown.vendorSettlement.grossPayable} />
              <AmountRow label="Advance paid" amount={financialBreakdown.vendorSettlement.advancePaid} />
              <AmountRow label="Balance payable" amount={financialBreakdown.vendorSettlement.balancePayable} />
              <AmountRow label="Balance paid" amount={financialBreakdown.vendorSettlement.balancePaid} />
              <AmountRow label="Vendor outstanding" amount={financialBreakdown.vendorSettlement.vendorOutstanding} emphasize />
            </BreakdownSection>
            <BreakdownSection title="Customer Settlement">
              <AmountRow label="Freight" amount={financialBreakdown.customerSettlement.customerFreight} />
              <AmountRow label="Loading" amount={financialBreakdown.customerSettlement.customerLoadingCharge} />
              <AmountRow label="Unloading" amount={financialBreakdown.customerSettlement.customerUnloadingCharge} />
              <AmountRow label="Invoice amount (trip)" amount={financialBreakdown.customerSettlement.invoiceAmount} emphasize />
              <AmountRow label="Customer paid" amount={financialBreakdown.customerSettlement.customerPaid} />
              <AmountRow label="Customer outstanding" amount={financialBreakdown.customerSettlement.customerOutstanding} emphasize />
            </BreakdownSection>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Profitability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Expected Margin</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{formatINR(profitability.expectedMargin)}</p>
              <p className="text-sm text-slate-500 mt-1">{profitability.expectedMarginPercent.toFixed(1)}% of sell</p>
              <p className="text-xs text-slate-400 mt-2">Sell rate − buy rate (booking)</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Settlement / Accrued Margin</p>
              {profitability.accruedMarginAvailable ? (
                <>
                  <p className="text-2xl font-bold text-violet-700 mt-2">{formatINR(profitability.accruedMargin!)}</p>
                  <p className="text-xs text-slate-400 mt-2">Finalized invoice − vendor final payable</p>
                </>
              ) : (
                <p className="text-lg font-medium text-slate-500 mt-2">Accrued margin: Not available</p>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Cash Margin</p>
              <p className="text-2xl font-bold text-emerald-700 mt-2">{formatINR(profitability.cashMargin)}</p>
              <p className="text-xs text-slate-400 mt-2">Customer payments − vendor payments (not accounting profit)</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-sm">
            <div className="rounded border px-4 py-3">
              <p className="text-slate-500">Margin %</p>
              <p className="font-semibold">{profitability.marginPercent?.toFixed(1) ?? "—"}%</p>
            </div>
            <div className="rounded border px-4 py-3">
              <p className="text-slate-500">Customer collected %</p>
              <p className="font-semibold">{profitability.customerCollectedPercent?.toFixed(1) ?? "—"}%</p>
            </div>
            <div className="rounded border px-4 py-3">
              <p className="text-slate-500">Vendor paid %</p>
              <p className="font-semibold">{profitability.vendorPaidPercent?.toFixed(1) ?? "—"}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Finance Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-500">No financial events recorded yet</p>
          ) : (
            <ol className="relative border-l border-slate-200 ml-2 space-y-4">
              {timeline.map((event) => (
                <li key={event.id} className="ml-6">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      {event.href ? (
                        <Link href={event.href} className="text-sm font-medium text-blue-600 hover:underline">
                          {event.label}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-slate-900">{event.label}</p>
                      )}
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {formatDate(event.timestamp)}
                        {event.amount != null && ` · ${formatINR(event.amount)}`}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">No finance documents available</p>
          ) : (
            <ul className="divide-y">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-3 text-sm gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{doc.title}</p>
                    <p className="text-xs text-slate-500">
                      {doc.type.replace(/_/g, " ")} · {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <a
                    href={doc.url.startsWith("/") ? doc.url : doc.url}
                    target={doc.url.startsWith("/") ? undefined : "_blank"}
                    rel={doc.url.startsWith("/") ? undefined : "noopener noreferrer"}
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline shrink-0"
                  >
                    View <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
