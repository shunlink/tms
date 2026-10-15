import Link from "next/link";
import { ArrowRight, ChevronRight, Shield } from "lucide-react";
import PortalAuthHero from "@/components/auth/portal-auth-hero";
import PortalAuthPageFooter from "@/components/auth/portal-auth-page-footer";
import BrandLogo from "@/components/brand-logo";
import { PORTAL_HERO, PORTAL_ROLE_CARDS } from "@/lib/portal-login-config";

export default function PortalSelectionPage() {
  const hero = PORTAL_HERO.selection;

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.14fr)_minmax(0,0.86fr)] bg-white">
      <PortalAuthHero config={hero} />

      <div className="flex flex-col min-h-screen px-6 py-8 sm:px-10 lg:px-12 xl:px-16 bg-white">
        <div className="flex items-center justify-between gap-4 mb-10">
          <div className="lg:hidden">
            <BrandLogo variant="light" href="/login" size="md" />
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <span className="hidden sm:inline">New to ShunLink TMS?</span>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 transition-colors min-h-[44px]"
            >
              Create an account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center w-full max-w-[34rem]">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-1 w-10 rounded-full bg-[#FFB800]" />
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500">WELCOME TO SHUNLINK TMS</p>
          </div>
          <h1 className="font-heading text-4xl sm:text-[2.5rem] font-bold text-[#1B2A4A] tracking-tight mb-3">
            Choose your portal
          </h1>
          <p className="text-slate-500 text-base mb-8">Access your dedicated workspace to continue.</p>

          <ul className="space-y-4">
            {PORTAL_ROLE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <li key={card.href}>
                  <Link
                    href={card.href}
                    className={`group flex items-center gap-4 rounded-2xl border p-5 sm:p-6 transition-all hover:shadow-md hover:-translate-y-0.5 ${card.cardBg} ${card.borderColor}`}
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
                    >
                      <Icon className={`h-6 w-6 ${card.iconColor}`} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-heading text-lg font-bold text-slate-900">{card.title}</p>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{card.description}</p>
                    </div>
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-slate-500 group-hover:border-slate-300 group-hover:text-slate-800 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Shield className="h-4 w-4 text-slate-400" />
            Secure access for a safer, smarter logistics ecosystem.
          </p>
          <p className="mt-4 text-center text-xs text-slate-400">
            Driver?{" "}
            <Link href="/login/driver" className="font-semibold text-slate-600 hover:underline">
              Sign in with OTP
            </Link>
          </p>
        </div>

        <PortalAuthPageFooter />
      </div>
    </div>
  );
}
