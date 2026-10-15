import Link from "next/link";
import PageHeader from "@/components/page-header";
import MasterOtpSettings from "@/components/superadmin/master-otp-settings";
import { requireSuperAdminActor } from "@/lib/page-auth";

export default async function SecuritySettingsPage() {
  await requireSuperAdminActor();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Security"
        description="Superadmin security controls"
      />
      <p className="text-sm text-slate-600">
        <Link href="/settings" className="text-teal-700 hover:underline">Settings</Link>
        {" · "}
        <Link href="/superadmin/portal-access" className="text-teal-700 hover:underline">Portal access</Link>
      </p>
      <MasterOtpSettings />
    </div>
  );
}
