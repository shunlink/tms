import { redirect } from "next/navigation";
import { requireSuperAdminActor } from "@/lib/page-auth";
import PortalAccessBanner from "@/components/superadmin/portal-access-banner";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminActor();
  return (
    <>
      <PortalAccessBanner />
      <div className="min-h-dvh bg-background">{children}</div>
    </>
  );
}
