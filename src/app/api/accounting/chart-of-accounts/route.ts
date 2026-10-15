import { requireAuth, authorize, ok, serverError, unauthorized } from "@/lib/api";
import { ensureChartOfAccounts, listChartOfAccounts } from "@/lib/accounting/chart-of-accounts.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.coa.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("activeOnly") === "true";
    const accounts = await listChartOfAccounts({ activeOnly });
    return ok({ accounts });
  } catch (e) {
    return serverError(e);
  }
}

/** Idempotent starter chart initialization (finance environments). */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.coa.manage");
  if (denied) return denied;

  try {
    const accounts = await ensureChartOfAccounts();
    return ok({ accounts, initialized: true });
  } catch (e) {
    return serverError(e);
  }
}
