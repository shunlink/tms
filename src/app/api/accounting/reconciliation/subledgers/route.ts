import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { buildSubledgerReconciliationReport } from "@/lib/accounting/subledger-reconciliation.service";
import { parseIsoDate } from "@/lib/accounting/report-query";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const asOf =
      parseIsoDate(url.searchParams.get("asOfDate"), "asOfDate") ?? new Date();
    const report = await buildSubledgerReconciliationReport({
      asOfDate: asOf,
      currency: url.searchParams.get("currency") ?? "INR",
      vendorId: url.searchParams.get("vendorId") ?? undefined,
      clientId: url.searchParams.get("clientId") ?? undefined,
    });
    return ok(report);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Invalid")) return badRequest(e.message);
    return serverError(e);
  }
}
