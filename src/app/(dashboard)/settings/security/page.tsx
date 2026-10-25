import PageHeader from "@/components/page-header";
import AdminSettingsNav from "@/components/settings/admin-settings-nav";
import MasterOtpSettings from "@/components/superadmin/master-otp-settings";
import { requireSuperAdminActor } from "@/lib/page-auth";

export default async function SecuritySettingsPage() {
  await requireSuperAdminActor();

  return (
    <div className="w-full max-w-3xl mx-auto pb-12 space-y-6">
      <PageHeader title="Security" description="Master OTP for superadmin portal access" />
      <AdminSettingsNav active="security" />
      <MasterOtpSettings />
    </div>
  );
}
