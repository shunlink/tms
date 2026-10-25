import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import {
  getLaneRates,
  getClientProfitability,
  getVendorScorecard,
  getOutstandingAgeing,
} from "@/lib/queries";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [lanes, clients, vendors, ageing] = await Promise.all([
    getLaneRates(),
    getClientProfitability(),
    getVendorScorecard(),
    getOutstandingAgeing(),
  ]);

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Rate benchmarking, profitability and outstanding"
      />

      {/* Outstanding ageing */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Outstanding</p>
            <p className="text-xl font-bold text-slate-900">{formatINR(ageing.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">0–30 days</p>
            <p className="text-xl font-bold text-slate-700">{formatINR(ageing.buckets.d0_30)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">31–60 days</p>
            <p className="text-xl font-bold text-amber-600">{formatINR(ageing.buckets.d31_60)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">61–90 days</p>
            <p className="text-xl font-bold text-orange-600">{formatINR(ageing.buckets.d61_90)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">90+ days</p>
            <p className="text-xl font-bold text-red-600">{formatINR(ageing.buckets.d90plus)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Lane rate benchmarking */}
        <Card>
          <CardHeader>
            <CardTitle>Lane Rate Benchmarking</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 font-medium">Lane</th>
                  <th className="pb-2 font-medium text-right">Trips</th>
                  <th className="pb-2 font-medium text-right">Avg Client</th>
                  <th className="pb-2 font-medium text-right">Avg Vendor</th>
                  <th className="pb-2 font-medium text-right">Avg Margin</th>
                  <th className="pb-2 font-medium text-right">Range</th>
                </tr>
              </thead>
              <tbody>
                {lanes.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-slate-400">No data.</td></tr>
                )}
                {lanes.map((l) => (
                  <tr key={l.route} className="border-b last:border-0">
                    <td className="py-2 text-slate-800">{l.route}</td>
                    <td className="py-2 text-right text-slate-600">{l.count}</td>
                    <td className="py-2 text-right text-slate-900">{formatINR(l.avgClient)}</td>
                    <td className="py-2 text-right text-slate-600">{formatINR(l.avgVendor)}</td>
                    <td className="py-2 text-right font-medium text-green-600">{formatINR(l.avgMargin)}</td>
                    <td className="py-2 text-right text-xs text-slate-500">
                      {formatINR(l.min)}–{formatINR(l.max)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Client profitability */}
        <Card>
          <CardHeader>
            <CardTitle>Client Profitability</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 font-medium text-right">Trips</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                  <th className="pb-2 font-medium text-right">Margin</th>
                  <th className="pb-2 font-medium text-right">Margin %</th>
                  <th className="pb-2 font-medium text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="py-2 text-slate-800">{c.name}</td>
                    <td className="py-2 text-right text-slate-600">{c.trips}</td>
                    <td className="py-2 text-right text-slate-900">{formatINR(c.revenue)}</td>
                    <td className="py-2 text-right font-medium text-green-600">{formatINR(c.margin)}</td>
                    <td className="py-2 text-right text-slate-600">{c.marginPct}%</td>
                    <td className="py-2 text-right text-slate-600">{formatINR(c.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Vendor scorecard */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Vendor Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 font-medium">Vendor</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Rating</th>
                <th className="pb-2 font-medium text-right">Trips</th>
                <th className="pb-2 font-medium text-right">Active</th>
                <th className="pb-2 font-medium text-right">Completion</th>
                <th className="pb-2 font-medium text-right">Margin Generated</th>
                <th className="pb-2 font-medium text-right">Pending Payable</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.name} className="border-b last:border-0">
                  <td className="py-2 text-slate-800">{v.name}</td>
                  <td className="py-2 text-slate-600">{v.type === "FLEET_OWNER" ? "Fleet" : "Broker"}</td>
                  <td className="py-2 text-right text-slate-600">{v.rating ? `${v.rating.toFixed(1)}★` : "—"}</td>
                  <td className="py-2 text-right text-slate-600">{v.trips}</td>
                  <td className="py-2 text-right text-slate-600">{v.active}</td>
                  <td className="py-2 text-right text-slate-600">{v.completionPct}%</td>
                  <td className="py-2 text-right font-medium text-green-600">{formatINR(v.marginGenerated)}</td>
                  <td className="py-2 text-right text-slate-900">{formatINR(v.pendingPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Outstanding detail */}
      <Card>
        <CardHeader>
          <CardTitle>Outstanding Invoices (days since issue)</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 font-medium">Invoice</th>
                <th className="pb-2 font-medium">Client</th>
                <th className="pb-2 font-medium text-right">Balance</th>
                <th className="pb-2 font-medium text-right">Days</th>
              </tr>
            </thead>
            <tbody>
              {ageing.rows.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-slate-400">No outstanding invoices.</td></tr>
              )}
              {ageing.rows.map((r) => (
                <tr key={r.invoiceNumber} className="border-b last:border-0">
                  <td className="py-2 font-medium text-blue-600">{r.invoiceNumber}</td>
                  <td className="py-2 text-slate-700">{r.client}</td>
                  <td className="py-2 text-right text-slate-900">{formatINR(r.balance)}</td>
                  <td className={`py-2 text-right ${r.days > 60 ? "text-red-600 font-medium" : "text-slate-600"}`}>
                    {r.days}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
