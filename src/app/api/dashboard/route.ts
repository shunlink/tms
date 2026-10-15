import { requireAuth, authorize, safeOk } from "@/lib/api";
import { getDashboard } from "@/lib/queries";
import { EMPTY_DASHBOARD } from "@/lib/safe-query";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "dashboard.view");
  if (denied) return denied;
  return safeOk("dashboard", () => getDashboard(), EMPTY_DASHBOARD);
}
