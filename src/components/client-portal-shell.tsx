"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  Truck,
  Receipt,
  Headphones,
  User,
  Search,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import BrandLogo from "./brand-logo";
import { signOut } from "next-auth/react";
import { portalUserInitial } from "@/lib/portal-theme";

type ClientPortalShellProps = {
  clientName: string;
  userName: string;
  children: React.ReactNode;
};

export default function ClientPortalShell({
  clientName,
  userName,
  children,
}: ClientPortalShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const initials = portalUserInitial(clientName || userName);

  const navSections = [
    {
      group: null,
      items: [
        {
          label: "Overview",
          href: "/portal/client",
          icon: Home,
          active: pathname === "/portal/client",
        },
      ],
    },
    {
      group: "TRANSPORT",
      items: [
        {
          label: "Requirements",
          href: "/portal/client/requirements",
          icon: ClipboardList,
          active: pathname.startsWith("/portal/client/requirements"),
        },
        {
          label: "Shipments",
          href: "/portal/client/trips",
          icon: Truck,
          active: pathname.startsWith("/portal/client/trips"),
        },
      ],
    },
    {
      group: "FINANCE",
      items: [
        {
          label: "Invoices",
          href: "/portal/client/invoices",
          icon: Receipt,
          active: pathname.startsWith("/portal/client/invoices"),
        },
      ],
    },
  ];

  return (
    <div className="flex flex-1 min-w-0 h-full overflow-hidden bg-[#F4F6F9]">
      {/* =========================================================================
          LEFT SIDEBAR (Pinned stationary tab portion)
          ========================================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-black text-white flex flex-col h-full shrink-0 transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top: Logo */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <BrandLogo variant="dark" size="md" href="/portal/client" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Nav items list (internal only if viewport is small) */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-4 py-2">
          <nav className="space-y-6">
            {navSections.map((section, idx) => (
              <div key={section.group ?? `group-${idx}`}>
                {section.group && (
                  <p className="px-3 text-[11px] font-bold text-neutral-400 tracking-[0.14em] uppercase mb-2">
                    {section.group}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-all ${
                          item.active
                            ? "bg-[#F5D33C] text-gray-950 font-bold shadow-sm"
                            : "text-neutral-300 hover:bg-neutral-900 hover:text-white font-medium"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            item.active ? "text-gray-950" : "text-neutral-400 group-hover:text-white"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Sidebar: Graphic Card + Support & Profile */}
        <div className="shrink-0 p-4 border-t border-neutral-900 space-y-3">
          {/* Mini Highway Graphic with Script */}
          <div className="relative rounded-xl overflow-hidden p-3.5 text-center bg-gradient-to-t from-neutral-950 to-neutral-900/80 border border-neutral-800 shadow-inner">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-30"
              style={{ backgroundImage: `url(/auth/shunlink-hero-bg.jpg)` }}
            />
            <div className="relative z-10">
              <p className="font-script text-lg text-white leading-tight">
                Together We Move More Possibilities.
              </p>
              <svg
                className="w-24 h-1.5 text-[#F5D33C] mx-auto mt-1"
                viewBox="0 0 100 8"
                fill="none"
              >
                <path
                  d="M2 6C30 2 70 2 98 5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <Link
              href="mailto:support@shunlink.in"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-900/60 transition-colors"
            >
              <Headphones className="h-4 w-4 text-neutral-400" />
              <span>Support</span>
            </Link>
            <Link
              href="/portal/client/profile"
              className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                pathname.startsWith("/portal/client/profile")
                  ? "bg-[#F5D33C] text-gray-950 font-bold"
                  : "text-neutral-300 hover:text-white hover:bg-neutral-900 font-medium"
              }`}
            >
              <User
                className={`h-4 w-4 shrink-0 transition-colors ${
                  pathname.startsWith("/portal/client/profile")
                    ? "text-gray-950"
                    : "text-neutral-400 group-hover:text-white"
                }`}
              />
              <span>Profile</span>
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login?portal=client" })}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
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
        <header className="shrink-0 z-30 bg-white border-b border-gray-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shadow-2xs">
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
                Client Portal
              </h1>
              <p className="text-xs text-gray-500 truncate max-w-[12rem] sm:max-w-none">
                {clientName}
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
                placeholder="Search shipments, requirements, invoices..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200/80 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C] focus:bg-white transition-all"
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
                className="flex items-center gap-2.5 p-1 sm:pr-2.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center">
                  {initials}
                </div>
                <span className="hidden sm:inline-block text-xs font-semibold text-gray-800 max-w-[10rem] truncate">
                  {clientName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:inline-block" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-40">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-900 truncate">{clientName}</p>
                    <p className="text-[11px] text-gray-500 truncate">{userName}</p>
                  </div>
                  <Link
                    href="/portal/client/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Profile & KYC Docs
                  </Link>
                  <Link
                    href="/portal/client/invoices"
                    onClick={() => setUserDropdownOpen(false)}
                    className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Invoices & Payments
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login?portal=client" })}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium border-t border-gray-100"
                  >
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
