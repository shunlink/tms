"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileSpreadsheet,
  Route,
  Receipt,
  User,
  Headphones,
  Search,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";
import BrandLogo from "./brand-logo";
import { signOut } from "next-auth/react";
import { portalUserInitial } from "@/lib/portal-theme";

function NavCountChip({ count, active }: { count: number; active?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={`ml-auto shrink-0 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        active
          ? "bg-gray-950 text-[#F5D33C]"
          : "bg-[#F5D33C] text-gray-950"
      }`}
      aria-hidden
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

type VendorPortalShellProps = {
  vendorName: string;
  userName: string;
  openIndentCount: number;
  assignedTripActionCount: number;
  children: React.ReactNode;
};

export default function VendorPortalShell({
  vendorName,
  userName,
  openIndentCount,
  assignedTripActionCount,
  children,
}: VendorPortalShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const initials = portalUserInitial(vendorName || userName);

  const navItems = [
    {
      label: "Overview",
      href: "/portal/vendor",
      icon: Home,
      active: pathname === "/portal/vendor",
      count: 0 as number,
      countLabel: undefined as string | undefined,
      hintWhenCount: false,
    },
    {
      label: "Open Indents",
      href: "/portal/vendor/indents",
      icon: FileSpreadsheet,
      active: pathname.startsWith("/portal/vendor/indents"),
      count: openIndentCount,
      countLabel: "open indents",
      hintWhenCount: true,
    },
    {
      label: "Assigned Trips",
      href: "/portal/vendor/trips",
      icon: Route,
      active: pathname.startsWith("/portal/vendor/trips"),
      count: assignedTripActionCount,
      countLabel: "trips need action",
      hintWhenCount: false,
    },
    {
      label: "Payments",
      href: "/portal/vendor/payments",
      icon: Receipt,
      active: pathname.startsWith("/portal/vendor/payments"),
      count: 0,
      countLabel: undefined,
      hintWhenCount: false,
    },
    {
      label: "Profile",
      href: "/portal/vendor/profile",
      icon: User,
      active: pathname.startsWith("/portal/vendor/profile"),
      hintWhenCount: false,
      count: 0,
      countLabel: undefined,
    },
  ];

  return (
    <div className="flex flex-1 min-w-0 h-full overflow-hidden bg-[#F4F6F9]">
      {/* =========================================================================
          LEFT SIDEBAR (Stationary / Fixed, Black bg with Yellow #F5D33C active tabs)
          ========================================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-black text-white flex flex-col h-full shrink-0 transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top: Logo */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <BrandLogo variant="dark" size="md" href="/portal/vendor" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-4 py-2">
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const showHint =
                item.hintWhenCount && item.count > 0 && !item.active;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={
                    item.count > 0 && item.countLabel
                      ? `${item.label}, ${item.count} ${item.countLabel}`
                      : item.label
                  }
                  className={`group flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-all ${
                    item.active
                      ? "portal-nav-active bg-[#F5D33C] text-gray-950 font-bold shadow-sm"
                      : "text-neutral-300 hover:bg-neutral-900 hover:text-white font-medium"
                  } ${showHint ? "portal-nav-open-indents-hint" : ""}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      item.active ? "text-gray-950" : "text-neutral-400 group-hover:text-white"
                    }`}
                  />
                  <span className="truncate flex-1 min-w-0">{item.label}</span>
                  <NavCountChip count={item.count} active={item.active} />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar: Moving Together Further card + Support */}
        <div className="shrink-0 p-4 border-t border-neutral-900 space-y-3.5">
          {/* Mini Highway Graphic Card */}
          <div className="relative rounded-2xl overflow-hidden p-4 text-left border border-neutral-800 shadow-lg bg-cover bg-center min-h-[140px] flex flex-col justify-end"
               style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.2) 100%), url(/images/vendor-sidebar-moving-further.jpg)` }}>
            <div className="relative z-10">
              <p className="font-script text-xl text-white leading-tight font-bold">
                Moving<br />
                Together<br />
                Further.
              </p>
              <svg
                className="w-20 h-2 text-[#F5D33C] mt-1"
                viewBox="0 0 100 8"
                fill="none"
              >
                <path
                  d="M2 6C30 2 70 2 98 5"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Need help & Contact Support */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2.5 px-1">
              <Headphones className="h-5 w-5 text-neutral-300 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-white leading-tight">Need help?</p>
                <p className="text-[11px] text-neutral-400 leading-tight">Our team is here 24/7</p>
              </div>
            </div>

            <Link
              href="mailto:founder@shunlink.in"
              className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors w-full"
            >
              <span>Contact Support</span>
              <ArrowRight className="h-3.5 w-3.5 text-neutral-300" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile menu */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* =========================================================================
          MAIN CONTENT WRAPPER (Top Header + Dashboard Content)
          ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="shrink-0 z-30 bg-white border-b border-gray-200/80 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 shadow-2xs">
          {/* Left: Mobile hamburger & Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-gray-950 leading-tight truncate">
                Vendor Portal
              </h1>
              <p className="text-xs text-gray-500 truncate max-w-[12rem] sm:max-w-none">
                {vendorName}
              </p>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Search trips, trip ID, location..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50/90 border border-gray-200/90 rounded-full text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Right: Notifications & User Avatar */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>

            {/* User Profile Badge */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1 sm:pr-2.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-[#F5D33C] text-gray-950 font-bold text-xs flex items-center justify-center shadow-xs">
                  {initials}
                </div>
                <span className="hidden sm:inline-block text-xs font-semibold text-gray-800 max-w-[10rem] truncate">
                  {userName || vendorName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:inline-block" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-200/80 py-1.5 z-40">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-900 truncate">{vendorName}</p>
                    <p className="text-[11px] text-gray-500 truncate">{userName}</p>
                  </div>
                  <Link
                    href="/portal/vendor/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Profile & KYC Docs
                  </Link>
                  <Link
                    href="/portal/vendor/payments"
                    onClick={() => setUserDropdownOpen(false)}
                    className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Payments & Settlement
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login?portal=transporter" })}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium border-t border-gray-100 flex items-center gap-2"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area (Only right portion scrolls) */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1400px] w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
