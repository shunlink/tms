"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route, User, Menu, X, LogOut, Headphones } from "lucide-react";
import BrandLogo from "./brand-logo";
import { signOut } from "next-auth/react";
import { portalUserInitial } from "@/lib/portal-theme";
import { driverPortalClasses } from "@/lib/driver-portal-theme";
import { cn } from "@/lib/utils";

type DriverPortalShellProps = {
  driverName: string;
  children: React.ReactNode;
};

export default function DriverPortalShell({ driverName, children }: DriverPortalShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const initials = portalUserInitial(driverName);

  const navItems = [
    {
      label: "Current Trip",
      href: "/driver",
      icon: Route,
      active: pathname === "/driver",
    },
    {
      label: "Profile",
      href: "/driver/profile",
      icon: User,
      active: pathname.startsWith("/driver/profile"),
    },
  ];

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden bg-[#F4F6F9]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-black text-white flex flex-col min-h-dvh lg:min-h-0 lg:h-full shrink-0 transition-transform duration-300",
          "lg:static lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-1 w-full shrink-0 bg-[#F5D33C]" aria-hidden />

        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <BrandLogo variant="dark" size="md" href="/driver" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-4 shrink-0">
          <div className="flex items-center gap-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 px-3 py-3">
            <div
              className={cn(
                "h-11 w-11 rounded-full font-bold text-sm flex items-center justify-center shrink-0",
                driverPortalClasses.accentBg,
                "text-gray-950"
              )}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{driverName}</p>
              <p className="text-xs text-neutral-400">Driver</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors min-h-[48px]",
                  item.active
                    ? driverPortalClasses.navActive
                    : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 p-4 mt-auto border-t border-neutral-800 space-y-3">
          <div className="hidden lg:flex items-center gap-2 px-2 text-neutral-400">
            <Headphones className="h-4 w-4 shrink-0" />
            <p className="text-[11px] leading-snug">Need help? Contact your operations team.</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login/driver" })}
            className="flex w-full items-center gap-2 px-3.5 py-3 rounded-xl text-sm text-rose-300 hover:bg-neutral-900 min-h-[48px] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex flex-1 flex-col min-w-0 min-h-0 lg:pl-0 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
        <header className="shrink-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200/80 px-4 py-3 flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-center min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-950 truncate">Driver Portal</p>
            <p className="text-xs text-gray-500 truncate">{driverName}</p>
          </div>
          <div
            className={cn(
              "h-9 w-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 text-gray-950",
              driverPortalClasses.accentBg
            )}
          >
            {initials}
          </div>
        </header>

        <header className="hidden lg:flex shrink-0 bg-white border-b border-gray-200/80 px-8 py-5 items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">ShunLink</p>
            <h1 className="text-lg font-bold text-gray-950 mt-0.5">Driver Portal</h1>
            <p className="text-xs text-gray-500 mt-0.5">Trip updates and live GPS tracking</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">{driverName}</p>
            <p className="text-xs text-gray-500">On the road</p>
          </div>
        </header>

        <main
          className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[radial-gradient(ellipse_120%_70%_at_50%_-15%,rgba(245,211,60,0.12),transparent_50%)]"
        >
          <div className="max-w-2xl lg:max-w-3xl w-full mx-auto min-w-0">{children}</div>
        </main>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur border-t border-gray-200/90 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex justify-around shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
        aria-label="Driver navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[5rem] min-h-[48px] px-3 py-1.5 rounded-2xl text-[11px] font-semibold transition-colors",
                item.active ? driverPortalClasses.bottomNavActive : "text-gray-500"
              )}
            >
              <Icon className={cn("h-5 w-5", item.active && "text-gray-900")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
