import { Shield, Users } from "lucide-react";
import PortalRoleLoginPage from "@/components/auth/portal-role-login-page";

export default function EmployeeLoginPage() {
  return (
    <PortalRoleLoginPage
      variant="employee"
      icon={Users}
      iconClassName="bg-[#E8F0FE] text-[#1D4ED8]"
      title="Employee Login"
      subtitle="Access your ShunLink internal workspace."
      emailLabel="Email or Employee ID"
      emailPlaceholder="you@shunlink.com or EMP1234"
      noticeFooter={
        <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3.5 text-sm text-slate-700">
          <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-slate-900">Authorized access only</span> — For ShunLink
            employees and internal team members.
          </p>
        </div>
      }
    />
  );
}
