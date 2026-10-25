import type { PermissionKey } from "./permissions";
import type { TeamCode } from "./teams";
import type { SidebarPendingCountKey } from "./sidebar-pending-keys";
import type { UserAccessMode } from "./services/access-role.service";

export type NavItem = {
  href: string;
  label: string;
  permission: PermissionKey;
  /** Key into GET /api/sidebar/pending-counts response */
  pendingCountKey?: SidebarPendingCountKey;
  /** When set, item is shown only for these roles (in addition to permission checks). */
  roles?: readonly string[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/** Sidebar navigation mapped to required permissions. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard", permission: "dashboard.view" }],
  },
  {
    title: "Operations",
    items: [
      { href: "/indents", label: "Indents", permission: "indent.view", pendingCountKey: "indents" },
      { href: "/placement", label: "Placement", permission: "placement.view", pendingCountKey: "placement" },
      {
        href: "/onboarding",
        label: "Onboarding Approvals",
        permission: "users.manage",
        pendingCountKey: "onboarding",
        roles: ["ADMIN", "SUPER_ADMIN"],
      },
      {
        href: "/onboarding-requests",
        label: "Onboarding Requests",
        permission: "onboarding.ops",
        pendingCountKey: "onboardingRequests",
        roles: ["OPERATIONS", "ADMIN", "SALES", "SUPER_ADMIN"],
      },
      { href: "/requirements", label: "Requirements", permission: "requirement.view", pendingCountKey: "requirements" },
      { href: "/trips", label: "Trips", permission: "trip.view", pendingCountKey: "trips" },
    ],
  },
  {
    title: "Partners",
    items: [
      { href: "/clients", label: "Clients", permission: "client.view" },
      { href: "/vendors", label: "Vendors", permission: "vendor.view" },
      { href: "/vehicles", label: "Vehicles", permission: "vehicle.view" },
      { href: "/drivers", label: "Drivers", permission: "driver.view" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/invoices", label: "Invoices", permission: "invoice.view", pendingCountKey: "invoices" },
      { href: "/receivables", label: "Receivables", permission: "invoice.view" },
      { href: "/payables", label: "Payables", permission: "payment.view" },
      {
        href: "/client-payments",
        label: "Client Payments",
        permission: "client.payment.manage",
        pendingCountKey: "clientPayments",
      },
      {
        href: "/payments",
        label: "Vendor Payments",
        permission: "payment.view",
        pendingCountKey: "vendorPayments",
      },
      { href: "/pods", label: "POD Queue", permission: "pod.view", pendingCountKey: "pods" },
      { href: "/accounting/journals", label: "Journal Register", permission: "accounting.journal.view" },
      { href: "/accounting/periods", label: "Accounting Periods", permission: "accounting.period.view" },
      { href: "/accounting/reports", label: "Financial Reports", permission: "accounting.report.view" },
      { href: "/accounting/subledgers/vendors", label: "Vendor Subledgers", permission: "accounting.subledger.view" },
      { href: "/accounting/subledgers/clients", label: "Client Subledgers", permission: "accounting.subledger.view" },
      { href: "/financial-notes", label: "Debit / Credit Notes", permission: "financial_note.view" },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/reports", label: "Reports", permission: "reports.view" },
      {
        href: "/notifications",
        label: "Notifications",
        permission: "notifications.manage",
        pendingCountKey: "notifications",
      },
    ],
  },
  {
    title: "Admin",
    items: [
      // Bidding System — hidden until bidding is fully launched (re-enable for ADMIN / SUPER_ADMIN).
      // {
      //   href: "/bidding-management",
      //   label: "Bidding System",
      //   permission: "dashboard.view",
      //   roles: ["ADMIN", "SUPER_ADMIN"],
      // },
      { href: "/users", label: "Employees & Users", permission: "users.manage" },
      { href: "/access-roles", label: "Access Role Bundles", permission: "roles.manage" },
      {
        href: "/audit",
        label: "Employee Activity",
        permission: "audit.view",
        pendingCountKey: "audit",
      },
      { href: "/settings", label: "Settings", permission: "users.manage" },
    ],
  },
];

/**
 * Team-specific sidebar for employees on **Inherit role permissions**.
 * Admin/Super Admin use full permission-based nav. Custom access roles ignore this list.
 */
export const TEAM_NAV_HREFS: Partial<Record<TeamCode, readonly string[]>> = {
  SALES: ["/", "/indents", "/requirements", "/onboarding-requests", "/clients"],
  OPERATIONS: [
    "/",
    "/indents",
    "/placement",
    "/onboarding",
    "/onboarding-requests",
    "/requirements",
    "/trips",
    "/clients",
    "/vendors",
    "/vehicles",
    "/drivers",
  ],
  FINANCE: [
    "/",
    "/indents",
    "/trips",
    "/invoices",
    "/receivables",
    "/payables",
    "/client-payments",
    "/payments",
    "/pods",
    "/accounting/journals",
    "/accounting/periods",
    "/accounting/reports",
    "/accounting/subledgers/vendors",
    "/accounting/subledgers/clients",
    "/financial-notes",
  ],
};

export type NavFilterOptions = {
  teamCode?: TeamCode;
  role?: string | null;
  /** CUSTOM_ROLES → sidebar from assigned bundles only (no team menu / job-role gates). */
  accessMode?: UserAccessMode;
};

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function canAccessNavItem(
  item: NavItem,
  permissions: Set<string> | string[],
  options?: NavFilterOptions
): boolean {
  const granted = permissions instanceof Set ? permissions : new Set(permissions);
  const { teamCode, role, accessMode } = options ?? {};
  const customBundlesOnly = accessMode === "CUSTOM_ROLES";
  const isAdminRole = role === "ADMIN" || role === "SUPER_ADMIN";
  const teamHrefs =
    !customBundlesOnly && teamCode && !isAdminRole ? TEAM_NAV_HREFS[teamCode] : null;

  if (!granted.has(item.permission)) return false;
  if (
    !customBundlesOnly &&
    item.roles?.length &&
    (!role || !item.roles.includes(role))
  ) {
    return false;
  }
  if (teamHrefs && !teamHrefs.includes(item.href)) return false;
  return true;
}

export function filterNavGroups(
  permissions: Set<string> | string[],
  options?: NavFilterOptions
): NavGroup[] {
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessNavItem(item, permissions, options)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat list of sidebar hrefs for a team (used in tests). Inherit-role team menu by default. */
export function getTeamSidebarHrefs(
  permissions: Set<string> | string[],
  teamCode: TeamCode,
  role?: string | null,
  accessMode?: UserAccessMode
): string[] {
  return filterNavGroups(permissions, { teamCode, role, accessMode }).flatMap((g) =>
    g.items.map((i) => i.href)
  );
}
