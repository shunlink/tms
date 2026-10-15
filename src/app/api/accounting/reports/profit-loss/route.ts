import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { buildProfitAndLossReport } from "@/lib/accounting/financial-reports.service";
import { parseReportDates } from "@/lib/accounting/report-query";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.report.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const { fromDate, toDate, currency } = parseReportDates(url);
    if (!fromDate || !toDate) return badRequest("fromDate and toDate are required (YYYY-MM-DD)");
    const report = await buildProfitAndLossReport({ fromDate, toDate, currency });
    return ok(report);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Invalid")) return badRequest(e.message);
    return serverError(e);
  }
}
