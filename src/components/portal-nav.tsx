"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Route,
  Wallet,
  User,
  ClipboardList,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NavBadge from "@/components/nav-badge";
import { useSidebarPendingCounts } from "@/hooks/use-sidebar-pending-counts";
import type { SidebarPendingCountKey } from "@/lib/sidebar-pending-keys";
import { PORTAL_THEME, type PortalAccent } from "@/lib/portal-theme";

export type PortalNavItem = {
  href: string;
  label: string;
  pendingCountKey?: SidebarPendingCountKey;
};

const ICON_MAP: Record<string, LucideIcon> = {
  "/portal/vendor": LayoutDashboard,
  "/portal/vendor/indents": FileSpreadsheet,
  "/portal/vendor/trips": Route,
  "/portal/vendor/payments": Wallet,
  "/portal/vendor/profile": User,
  "/portal/client": LayoutDashboard,
  "/portal/client/trips": Route,
  "/portal/client/requirements": ClipboardList,
  "/portal/client/invoices": FileText,
  "/portal/client/profile": User,
  "/driver": Route,
  "/driver/profile": User,
};

export default function PortalNav({
  items,
  variant = "light",
  accent = "vendor",
  className,
}: {
  items: PortalNavItem[];
  variant?: "light" | "dark";
  accent?: PortalAccent;
  className?: string;
}) {
  const pathname = usePathname();
  const { counts } = useSidebarPendingCounts();
  const isDark = variant === "dark";
  const theme = PORTAL_THEME[accent];

  return (
    <nav
      className={cn(
        "max-w-6xl mx-auto px-3 sm:px-6 flex gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-none print:hidden pb-2 sm:pb-0",
        isDark ? "bg-sidebar/98 border-t border-white/10" : "bg-white border-b border-border",
        className
      )}
      aria-label="Portal navigation"
    >
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        const Icon = ICON_MAP[it.href];
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-2 px-3.5 sm:px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-lg whitespace-nowrap transition-all",
              isDark
                ? active
                  ? cn(theme.navActive, "shadow-sm ring-1 ring-white/10")
                  : "text-white/75 hover:text-white hover:bg-white/5"
                : active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
            aria-current={active ? "page" : undefined}
          >
            {Icon && (
              <Icon
                className={cn(
                  "h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem] shrink-0",
                  isDark && active && (accent === "client" ? "text-teal-300" : "text-amber-200")
                )}
              />
            )}
            <span>{it.label}</span>
            {it.pendingCountKey && (
              <NavBadge
                count={counts[it.pendingCountKey] ?? 0}
                variant="portal"
                className={
                  isDark
                    ? accent === "client"
                      ? "bg-teal-500 text-white"
                      : "bg-accent text-white"
                    : undefined
                }
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
