import { requireAuth, ok, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
import { getSidebarPendingCounts } from "@/lib/services/sidebar-pending-counts.service";
import { getGrantedPermissions } from "@/lib/services/permission.service";
import { resolveUserTeam } from "@/lib/services/team-dashboard.service";
import type { SidebarCountsResponse } from "@/lib/services/sidebar-pending-counts.service";

export async function GET() {
  const auth = await requireAuth();
  if (!auth?.user?.id) return unauthorized();

  const user = auth.user;
  const [granted, { teamCode }] = await Promise.all([
    getGrantedPermissions(user.id),
    resolveUserTeam(user),
  ]);

  const counts = await getSidebarPendingCounts({
    userId: user.id,
    role: user.role ?? "OPERATIONS",
    teamCode,
    clientId: user.clientId,
    vendorId: user.vendorId,
    granted,
  });

  return ok(stripZeros(counts));
}

function stripZeros(counts: SidebarCountsResponse): SidebarCountsResponse {
  const out: SidebarCountsResponse = {};
  for (const [key, value] of Object.entries(counts)) {
    if (value && value > 0) out[key as keyof SidebarCountsResponse] = value;
  }
  return out;
}
