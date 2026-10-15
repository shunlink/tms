import { requireAuth, authorize, ok, serverError, unauthorized } from "@/lib/api";
import {
  ensureDefaultAccountingPeriods,
  listAccountingPeriods,
} from "@/lib/accounting/accounting-period.service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.period.view");
  if (denied) return denied;

  try {
    const periods = await listAccountingPeriods();
    return ok({ periods });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.period.close");
  if (denied) return denied;

  try {
    const period = await ensureDefaultAccountingPeriods();
    return ok({ period });
  } catch (e) {
    return serverError(e);
  }
}
