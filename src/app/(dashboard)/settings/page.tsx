import PageHeader from "@/components/page-header";
import AdminSettingsNav from "@/components/settings/admin-settings-nav";
import CompanySettingsSection from "@/components/settings/company-settings-section";
import { getActorSessionUser } from "@/lib/auth";
import { requirePagePermission } from "@/lib/page-auth";

export default async function SettingsPage() {
  await requirePagePermission("users.manage");
  const actor = await getActorSessionUser();
  const canEdit = actor?.role === "SUPER_ADMIN";

  return (
    <div className="w-full max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Settings"
        description="Company letterhead, bank details, and operational preferences"
      />
      <AdminSettingsNav active="settings" />
      <CompanySettingsSection canEdit={canEdit} />
    </div>
  );
}
