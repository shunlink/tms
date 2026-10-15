import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { buildTrialBalanceReport } from "@/lib/accounting/financial-reports.service";
import { parseReportDates } from "@/lib/accounting/report-query";
import { trialBalanceToCsv } from "@/lib/accounting/report-export";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.report.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const { asOf, currency } = parseReportDates(url);
    if (!asOf) return badRequest("asOfDate is required (YYYY-MM-DD)");
    const includeZero = url.searchParams.get("includeZero") === "true";
    const report = await buildTrialBalanceReport({
      asOfDate: asOf,
      currency,
      includeZeroBalances: includeZero,
    });

    if (url.searchParams.get("format") === "csv") {
      const exportDenied = await authorize(auth, "accounting.report.export");
      if (exportDenied) return exportDenied;
      const csv = trialBalanceToCsv(report.rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="trial-balance-${report.meta.asOfDate}.csv"`,
        },
      });
    }

    return ok(report);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Invalid")) return badRequest(e.message);
    return serverError(e);
  }
}
