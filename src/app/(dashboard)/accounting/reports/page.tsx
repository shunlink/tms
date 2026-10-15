import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type DataColumn } from "@/components/data-table";
import PageHeader from "@/components/page-header";
import { formatInrMinor } from "@/components/accounting/money-cells";
import {
  buildTrialBalanceReport,
  buildProfitAndLossReport,
  buildBalanceSheetReport,
  CASH_FLOW_REPORTING_NOTE,
} from "@/lib/accounting/financial-reports.service";
import { requirePagePermission } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

const tbColumns: DataColumn[] = [
  {
    key: "accountCode",
    header: "Code",
    kind: "link",
    hrefPrefix: "/accounting/reports/account/",
    idKey: "accountCode",
  },
  { key: "accountName", header: "Account" },
  { key: "accountType", header: "Type" },
  { key: "netDebit", header: "Debit" },
  { key: "netCredit", header: "Credit" },
];

type SearchParams = { asOfDate?: string; fromDate?: string; toDate?: string };

function defaultDates() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const from = new Date(y, m, 1);
  return {
    asOf: today.toISOString().slice(0, 10),
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

export default async function AccountingReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("accounting.report.view");
  const defaults = defaultDates();
  const asOfDate = new Date(searchParams.asOfDate ?? defaults.asOf);
  const fromDate = new Date(searchParams.fromDate ?? defaults.from);
  const toDate = new Date(searchParams.toDate ?? defaults.to);

  const [trialBalance, profitLoss, balanceSheet] = await Promise.all([
    buildTrialBalanceReport({ asOfDate }),
    buildProfitAndLossReport({ fromDate, toDate }),
    buildBalanceSheetReport({ asOfDate, periodStartForEarnings: fromDate }),
  ]);

  const tbRows = trialBalance.rows.map((r) => ({
    id: r.accountId,
    accountCode: r.accountCode,
    accountName: r.accountName,
    accountType: r.accountType,
    netDebit: r.netDebitMinor ? formatInrMinor(r.netDebitMinor) : "—",
    netCredit: r.netCreditMinor ? formatInrMinor(r.netCreditMinor) : "—",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        description="Posted general-ledger reports (not statutory statements)"
      />

      <Card>
        <CardHeader>
          <CardTitle>Report filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3 items-end text-sm">
            <label className="flex flex-col gap-1">
              As-of date
              <input
                type="date"
                name="asOfDate"
                defaultValue={searchParams.asOfDate ?? defaults.asOf}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              P&amp;L / earnings from
              <input
                type="date"
                name="fromDate"
                defaultValue={searchParams.fromDate ?? defaults.from}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              P&amp;L / earnings to
              <input
                type="date"
                name="toDate"
                defaultValue={searchParams.toDate ?? defaults.to}
                className="border rounded px-2 py-1"
              />
            </label>
            <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1.5">
              Apply
            </button>
            <a
              className="text-blue-600 underline"
              href={`/api/accounting/reports/trial-balance?asOfDate=${asOfDate.toISOString().slice(0, 10)}&format=csv`}
            >
              Export trial balance CSV
            </a>
          </form>
          <p className="text-xs text-slate-500 mt-3">{trialBalance.meta.disclaimer}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Trial balance — {trialBalance.meta.asOfDate}{" "}
            {trialBalance.isBalanced ? (
              <span className="text-green-700 text-sm font-normal">(balanced)</span>
            ) : (
              <span className="text-red-700 text-sm font-normal">
                (imbalance {formatInrMinor(trialBalance.imbalanceMinor)})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={tbColumns} rows={tbRows} pageSize={25} />
          <p className="text-xs text-slate-500 mt-2">
            Includes accounts with posted activity only. Grand debits{" "}
            {formatInrMinor(trialBalance.grandTotalDebitMinor)} / credits{" "}
            {formatInrMinor(trialBalance.grandTotalCreditMinor)}.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Profit &amp; loss — {profitLoss.meta.accountingDateFrom} to{" "}
              {profitLoss.meta.accountingDateTo}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Revenue: {formatInrMinor(profitLoss.revenue.subtotalMinor)}</p>
            <p>Expenses: {formatInrMinor(profitLoss.expenses.subtotalMinor)}</p>
            <p className="font-medium">
              Net {profitLoss.netProfitMinor >= 0 ? "profit" : "loss"}:{" "}
              {formatInrMinor(Math.abs(profitLoss.netProfitMinor))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance sheet — {balanceSheet.meta.asOfDate}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Assets: {formatInrMinor(balanceSheet.totalAssetsMinor)}</p>
            <p>Liabilities: {formatInrMinor(balanceSheet.totalLiabilitiesMinor)}</p>
            <p>Equity (accounts): {formatInrMinor(balanceSheet.equity.subtotalMinor)}</p>
            <p>Current period earnings: {formatInrMinor(balanceSheet.currentPeriodEarningsMinor)}</p>
            <p>Total equity: {formatInrMinor(balanceSheet.totalEquityMinor)}</p>
            {!balanceSheet.equationHolds && (
              <p className="text-red-700">
                Equation variance: {formatInrMinor(balanceSheet.equationDifferenceMinor)} — review
                unclosed P&amp;L and missing opening entries.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cash flow</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">{CASH_FLOW_REPORTING_NOTE}</CardContent>
      </Card>
    </div>
  );
}
