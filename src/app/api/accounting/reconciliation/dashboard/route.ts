import { requireAuth, authorize, ok, serverError, unauthorized } from "@/lib/api";
import { buildReconciliationDashboard } from "@/lib/accounting/reconciliation/reconciliation-dashboard.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const glAccountCode = url.searchParams.get("glAccountCode") ?? undefined;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const dashboard = await buildReconciliationDashboard({
      glAccountCode,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return ok(dashboard);
  } catch (e) {
    return serverError(e);
  }
}
