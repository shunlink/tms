import { redirect } from "next/navigation";
import DriverPortalShell from "@/components/driver-portal-shell";
import PortalAccessBanner from "@/components/superadmin/portal-access-banner";
import { getSessionUser } from "@/lib/auth";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "DRIVER") redirect("/");
  if (!user.driverId) redirect("/login");

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <PortalAccessBanner />
      <DriverPortalShell driverName={user.name ?? "Driver"}>{children}</DriverPortalShell>
    </div>
  );
}
