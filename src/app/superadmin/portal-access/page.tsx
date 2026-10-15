import Link from "next/link";
import PageHeader from "@/components/page-header";
import PortalAccessForm from "@/components/superadmin/portal-access-form";
import MasterOtpSettings from "@/components/superadmin/master-otp-settings";

export default function SuperadminPortalAccessPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <PageHeader
        title="Superadmin portal access"
        description="Support and audit employee portals without using employee passwords."
      />
      <p className="text-sm text-slate-600">
        <Link href="/" className="text-teal-700 hover:underline">Back to dashboard</Link>
        {" · "}
        <Link href="/settings/security" className="text-teal-700 hover:underline">Security settings</Link>
      </p>
      <PortalAccessForm />
      <MasterOtpSettings />
    </div>
  );
}
