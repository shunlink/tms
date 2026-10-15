import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { buildBalanceSheetReport } from "@/lib/accounting/financial-reports.service";
import { parseIsoDate, parseReportDates } from "@/lib/accounting/report-query";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.report.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const { asOf, currency, fromDate } = parseReportDates(url);
    if (!asOf) return badRequest("asOfDate is required (YYYY-MM-DD)");
    const periodStart = parseIsoDate(url.searchParams.get("periodStart"), "periodStart") ?? fromDate;
    const report = await buildBalanceSheetReport({
      asOfDate: asOf,
      currency,
      periodStartForEarnings: periodStart ?? undefined,
    });
    return ok(report);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Invalid")) return badRequest(e.message);
    return serverError(e);
  }
}
