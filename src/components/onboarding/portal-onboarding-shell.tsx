"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Headphones, Bell, ChevronDown } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import SignOutButton from "@/components/sign-out-button";
import { portalUserInitial } from "@/lib/portal-theme";
import type { OnboardingPortalKind } from "@/lib/onboarding-progress";

export default function PortalOnboardingShell({
  kind,
  entityName,
  userEmail,
  children,
}: {
  kind: OnboardingPortalKind;
  entityName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = kind === "client" ? "Client Onboarding" : "Vendor Onboarding";
  const initial = portalUserInitial(entityName || userEmail);

  return (
    <div className="h-dvh flex overflow-hidden bg-[#F4F6F9]">
      <aside className="hidden lg:flex w-[220px] shrink-0 h-dvh flex-col overflow-hidden bg-[#0B1220] text-white">
        <div className="px-5 pt-6 pb-8">
          <BrandLogo variant="dark" size="md" href="/login" />
        </div>
        <nav className="flex-1 px-3 space-y-1">
          <Link
            href={kind === "client" ? "/onboard/client" : "/onboard/vendor"}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
              pathname.startsWith("/onboard")
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5"
            }`}
          >
            <ClipboardList className="h-4 w-4 text-amber-400" />
            Onboarding
          </Link>
          <a
            href="mailto:founder@shunlink.in"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5"
          >
            <Headphones className="h-4 w-4" />
            Support
          </a>
        </nav>
        <div className="p-4 border-t border-white/10">
          <SignOutButton className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-[#0F172A] truncate">{title}</h1>
            <p className="text-xs text-slate-500 truncate">{entityName}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white pl-1 pr-2 py-1"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white text-sm font-bold">
                {initial}
              </span>
              <span className="hidden sm:block text-xs font-medium text-slate-700 max-w-[140px] truncate">
                {userEmail}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
            </button>
            <div className="lg:hidden">
              <SignOutButton className="p-2 text-slate-500 text-xs" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
