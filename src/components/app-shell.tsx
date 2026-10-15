"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  ClipboardCheck,
  ClipboardList,
  Route,
  Users,
  Truck,
  Gauge,
  UserCircle,
  UserPlus,
  FileText,
  Receipt,
  CreditCard,
  IndianRupee,
  BarChart3,
  Bell,
  UserCog,
  ScrollText,
  Settings,
  Menu,
  LogOut,
  X,
  Wallet,
  Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import BrandLogo from "@/components/brand-logo";
import NavBadge from "@/components/nav-badge";
import { useSidebarPendingCounts } from "@/hooks/use-sidebar-pending-counts";
import { filterNavGroups } from "@/lib/nav-permissions";
import type { SidebarPendingCountKey } from "@/lib/sidebar-pending-keys";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/": LayoutDashboard,
  "/indents": FileSpreadsheet,
  "/placement": ClipboardCheck,
  "/onboarding": UserPlus,
  "/requirements": ClipboardList,
  "/trips": Route,
  "/pods": ClipboardCheck,
  "/clients": Users,
  "/vendors": Truck,
  "/vehicles": Gauge,
  "/drivers": UserCircle,
  "/invoices": FileText,
  "/receivables": IndianRupee,
  "/payables": Wallet,
  "/client-payments": Receipt,
  "/payments": CreditCard,
  "/balance-payments": CreditCard,
  "/advance-payments": IndianRupee,
  "/reports": BarChart3,
  "/notifications": Bell,
  "/users": UserCog,
  "/permissions": Settings,
  "/audit": ScrollText,
  "/settings": Settings,
  "/bidding-management": Gavel,
};

export default function AppShell({
  user,
  permissions,
  teamCode,
  children,
}: {
  user: { name?: string | null; email?: string | null; role?: string; teamName?: string | null };
  permissions: string[];
  teamCode?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const { counts } = useSidebarPendingCounts();

  const visibleGroups = useMemo(
    () => filterNavGroups(permissions, { teamCode: teamCode as import("@/lib/teams").TeamCode | undefined, role: user.role }),
    [permissions, teamCode, user.role]
  );

  const badgeFor = (key?: SidebarPendingCountKey) =>
    key ? counts[key] ?? 0 : 0;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-black text-white flex flex-col h-screen transition-transform lg:static lg:translate-x-0 print:hidden border-r border-neutral-900",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <BrandLogo variant="dark" showSubtitle subtitle="Transport Management" href="/" size="lg" />
          <button className="lg:hidden text-neutral-400 hover:text-white" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none p-3 space-y-5">
          {visibleGroups.map((g) => (
            <div key={g.title}>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {g.title}
              </p>
              <div className="space-y-1">
                {g.items.map((item) => {
                  const Icon = ICONS[item.href] ?? LayoutDashboard;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                        active
                          ? "bg-[#F5D33C] text-gray-950 font-bold shadow-sm"
                          : "text-neutral-300 hover:bg-neutral-900 hover:text-white font-medium"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          active ? "text-gray-950" : "text-neutral-400 group-hover:text-white"
                        )}
                      />
                      <span className="truncate flex-1">{item.label}</span>
                      <NavBadge
                        count={badgeFor(item.pendingCountKey)}
                        variant="sidebar"
                        className={active ? "bg-gray-950 text-white" : undefined}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-neutral-800 p-4 space-y-2">
          <div className="flex items-center gap-3 px-1">
            <div className="h-9 w-9 rounded-full bg-[#F5D33C] text-gray-950 flex items-center justify-center text-sm font-bold">
              {(user.name ?? "U").charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name ?? "User"}</p>
              <p className="text-xs text-neutral-400 truncate">
                {user.teamName ? `${user.teamName} · ` : ""}
                {user.email ?? user.role ?? ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
        <header className="shrink-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-6 print:hidden">
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          <nav className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="text-border">/</span>
                <span className={i === crumbs.length - 1 ? "text-foreground font-medium capitalize" : "capitalize"}>
                  {c.replace(/-/g, " ")}
                </span>
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {permissions.includes("notifications.manage") && (
              <Link
                href="/notifications"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-input bg-background hover:bg-muted"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {(counts.notifications ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                    {counts.notifications! > 99 ? "99+" : counts.notifications}
                  </span>
                )}
              </Link>
            )}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 hover:bg-muted"
              >
                <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {(user.name ?? "U").charAt(0)}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-1 shadow-lg">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold truncate">{user.name ?? "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  {permissions.includes("users.manage") && (
                    <Link href="/settings" className="block rounded-lg px-4 py-2.5 text-sm hover:bg-muted">
                      Settings
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-destructive hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 print:bg-white print:p-0">{children}</main>
      </div>
    </div>
  );
}
