import { requireInternalSession } from "@/lib/page-auth";
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
import AdminDashboard from "@/components/dashboard/admin-dashboard";
import SalesDashboard from "@/components/dashboard/sales-dashboard";
import OperationsDashboard from "@/components/dashboard/operations-dashboard";
import FinanceDashboard from "@/components/dashboard/finance-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireInternalSession();
  const { teamCode } = await resolveUserTeam(user);

  if (isAdminTeam(teamCode, user.role)) {
    const [data, extras] = await Promise.all([getDashboard(), getAdminDashboardExtras(user)]);
    return <AdminDashboard data={data} extras={extras} isSuperAdmin={user.role === "SUPER_ADMIN"} />;
  }

  switch (teamCode) {
    case "SALES": {
      const data = await getSalesDashboard(user);
      return <SalesDashboard data={data} />;
    }
    case "OPERATIONS": {
      const data = await getOperationsDashboard(user);
      return <OperationsDashboard data={data} />;
    }
    case "FINANCE": {
      const filters = parseFinanceDashboardFilters(searchParams ?? {});
      const data = await getFinanceDashboard(user, filters);
      return <FinanceDashboard data={data} />;
    }
    default: {
      const [data, extras] = await Promise.all([getDashboard(), getAdminDashboardExtras(user)]);
      return <AdminDashboard data={data} extras={extras} isSuperAdmin={user.role === "SUPER_ADMIN"} />;
    }
  }
}
