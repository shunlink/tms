import { NextResponse } from "next/server";
import { requireAuth, authorize } from "@/lib/api";
import { getDashboard } from "@/lib/queries";
import {
  getAdminDashboardExtras,
  getFinanceDashboard,
  getOperationsDashboard,
  getSalesDashboard,
  isAdminTeam,
  resolveUserTeam,
} from "@/lib/services/team-dashboard.service";
import { parseFinanceDashboardFilters } from "@/lib/services/finance-dashboard.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "dashboard.view");
  if (denied) return denied;

  const user = auth!.user;
  const { teamCode } = await resolveUserTeam(user);

  if (isAdminTeam(teamCode, user.role)) {
    const [dashboard, extras] = await Promise.all([getDashboard(), getAdminDashboardExtras(user)]);
    return NextResponse.json({ team: "ADMIN", dashboard, extras });
  }

  switch (teamCode) {
    case "SALES":
      return NextResponse.json({ team: "SALES", data: await getSalesDashboard(user) });
    case "OPERATIONS":
      return NextResponse.json({ team: "OPERATIONS", data: await getOperationsDashboard(user) });
    case "FINANCE": {
      const url = new URL(req.url);
      const filters = parseFinanceDashboardFilters(
        Object.fromEntries(url.searchParams.entries())
      );
      return NextResponse.json({ team: "FINANCE", data: await getFinanceDashboard(user, filters) });
    }
    default:
      return NextResponse.json({ team: teamCode, data: null }, { status: 404 });
  }
}
