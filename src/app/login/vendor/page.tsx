import Link from "next/link";
import { ArrowRight, Truck, UserPlus } from "lucide-react";
import PortalRoleLoginPage from "@/components/auth/portal-role-login-page";

export default function VendorLoginPage() {
  return (
    <PortalRoleLoginPage
      variant="vendor"
      icon={Truck}
      iconClassName="bg-[#E6F6EE] text-[#15803D]"
      title="Signin"
      subtitle="Access loads, manage trips and grow with ShunLink."
      extraCardFooter={
        <div className="mt-6 flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/90 px-4 py-4 text-sm text-slate-700">
          <UserPlus className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="leading-relaxed">
              New to ShunLink? Register your transporter business to get started.
            </p>
            <Link
              href="/signup/vendor"
              className="inline-flex items-center gap-1 mt-2 font-bold text-emerald-700 hover:underline"
            >
              Register now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      }
    />
  );
}
