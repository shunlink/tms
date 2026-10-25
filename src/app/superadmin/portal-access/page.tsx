import PageHeader from "@/components/page-header";
import AdminSettingsNav from "@/components/settings/admin-settings-nav";
import PortalAccessForm from "@/components/superadmin/portal-access-form";
import { requireSuperAdminActor } from "@/lib/page-auth";

export default async function SuperadminPortalAccessPage() {
  await requireSuperAdminActor();

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <PageHeader
        title="Superadmin portal access"
        description="Support and audit employee portals without using employee passwords."
      />
      <AdminSettingsNav active="portal" />
      <PortalAccessForm />
    </div>
  );
}
