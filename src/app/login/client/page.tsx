import Link from "next/link";
import { Building2 } from "lucide-react";
import PortalRoleLoginPage from "@/components/auth/portal-role-login-page";

export default function ClientLoginPage() {
  return (
    <PortalRoleLoginPage
      variant="client"
      icon={Building2}
      iconClassName="bg-[#FFF4D6] text-[#B45309]"
      title="Signin"
      subtitle="Access your ShunLink TMS workspace."
      supportFooter={
        <p className="text-center text-sm text-slate-500 pt-2">
          Need help?{" "}
          <Link href="/welcome" className="font-bold text-blue-600 hover:underline">
            Contact Support
          </Link>
        </p>
      }
    />
  );
}
