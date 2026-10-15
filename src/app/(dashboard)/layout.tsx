import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import PortalAccessBanner from "@/components/superadmin/portal-access-banner";
import { getSessionUser } from "@/lib/auth";
import { getGrantedPermissions } from "@/lib/services/permission.service";
import { resolveUserTeam } from "@/lib/services/team-dashboard.service";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "CLIENT") redirect("/portal/client");
  if (user.role === "VENDOR") redirect("/portal/vendor");
  if (user.role === "DRIVER") redirect("/driver");

  const userId = user.id!;
  const [permissions, employee, { teamCode }] = await Promise.all([
    getGrantedPermissions(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { team: { select: { name: true } } },
    }),
    resolveUserTeam(user),
  ]);

  return (
    <>
      <PortalAccessBanner />
      <AppShell
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
          teamName: employee?.team?.name ?? null,
        }}
        permissions={Array.from(permissions)}
        teamCode={teamCode}
      >
        {children}
      </AppShell>
    </>
  );
}
