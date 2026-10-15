import { requireAuth, authorize, ok, notFound, serverError, unauthorized } from "@/lib/api";
import { getChartOfAccountById } from "@/lib/accounting/chart-of-accounts.service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.coa.view");
  if (denied) return denied;

  try {
    const account = await getChartOfAccountById(params.id);
    if (!account) return notFound("Account not found");
    return ok(account);
  } catch (e) {
    return serverError(e);
  }
}
