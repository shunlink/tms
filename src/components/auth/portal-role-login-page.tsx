import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PortalAuthHero from "@/components/auth/portal-auth-hero";
import PortalAuthPageFooter from "@/components/auth/portal-auth-page-footer";
import PortalCredentialsForm from "@/components/auth/portal-credentials-form";
import PortalLoginCard from "@/components/auth/portal-login-card";
import BrandLogo from "@/components/brand-logo";
import type { PortalLoginVariant } from "@/lib/portal-login-config";
import { PORTAL_HERO } from "@/lib/portal-login-config";

type PortalRoleLoginPageProps = {
  variant: Exclude<PortalLoginVariant, "selection">;
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  supportFooter?: React.ReactNode;
  noticeFooter?: React.ReactNode;
  extraCardFooter?: React.ReactNode;
};

export default function PortalRoleLoginPage({
  variant,
  icon,
  iconClassName,
  title,
  subtitle,
  emailLabel,
  emailPlaceholder,
  supportFooter,
  noticeFooter,
  extraCardFooter,
}: PortalRoleLoginPageProps) {
  const hero = PORTAL_HERO[variant];

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.14fr)_minmax(0,0.86fr)] bg-[#F3F4F6]">
      <PortalAuthHero config={hero} />

      <div className="flex flex-col min-h-screen bg-[#F3F4F6] px-6 py-8 sm:px-10 lg:px-12 xl:px-14">
        <div className="mb-8 lg:mb-10">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to portal selection
          </Link>
          <div className="mt-6 lg:hidden">
            <BrandLogo variant="light" href="/login" size="md" />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <PortalLoginCard
            icon={icon}
            iconClassName={iconClassName}
            title={title}
            subtitle={subtitle}
          >
            <PortalCredentialsForm
              loginPortal={variant}
              emailLabel={emailLabel}
              emailPlaceholder={emailPlaceholder}
              supportFooter={supportFooter}
              noticeFooter={noticeFooter}
            />
            {extraCardFooter}
          </PortalLoginCard>
        </div>

        <PortalAuthPageFooter />
      </div>
    </div>
  );
}
