import {
  ALL_NAV_ITEMS,
  canAccessNavItem,
  filterNavGroups,
  getTeamSidebarHrefs,
  type NavFilterOptions,
  type NavItem,
} from "./nav-permissions";
import { ROUTE_EXTENSION_RULES } from "./route-access-rules";
export type RouteAccessContext = NavFilterOptions & {
  granted: Set<string> | string[];
  /** Real Super Admin, not impersonating. */
  superBypass?: boolean;
};

export function normalizePathname(pathname: string): string {
  const path = pathname.split("?")[0].split("#")[0];
  if (!path || path === "") return "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function grantedSet(ctx: RouteAccessContext): Set<string> {
  return ctx.granted instanceof Set ? ctx.granted : new Set(ctx.granted);
}

function findNavItemForPath(path: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of ALL_NAV_ITEMS) {
    if (path === item.href || (item.href !== "/" && path.startsWith(`${item.href}/`))) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  if (path === "/") {
    return ALL_NAV_ITEMS.find((i) => i.href === "/") ?? null;
  }
  return best;
}

function hasRequiredPermissions(granted: Set<string>, rule: {
  permission?: string;
  permissionsAny?: string[];
}): boolean {
  if (rule.permission) return granted.has(rule.permission);
  if (rule.permissionsAny?.length) {
    return rule.permissionsAny.some((p) => granted.has(p));
  }
  return true;
}

/** Whether the user may open this dashboard pathname (sidebar + extension rules). */
export function canAccessHref(pathname: string, ctx: RouteAccessContext): boolean {
  const path = normalizePathname(pathname);

  if (ctx.superBypass) return true;

  const granted = grantedSet(ctx);

  for (const rule of ROUTE_EXTENSION_RULES) {
    if (!rule.pattern.test(path)) continue;
    if (rule.superAdminOnly) return false;
    if (!hasRequiredPermissions(granted, rule)) return false;
    if (rule.navHref) {
      const navItem = ALL_NAV_ITEMS.find((i) => i.href === rule.navHref);
      if (navItem && !canAccessNavItem(navItem, granted, ctx)) return false;
    }
    return true;
  }

  const navItem = findNavItemForPath(path);
  if (!navItem) return false;

  return canAccessNavItem(navItem, granted, ctx);
}

export function parseRefererPath(referer: string | null | undefined, origin: string | null): string | null {
  if (!referer || !origin) return null;
  try {
    const ref = new URL(referer);
    const base = new URL(origin);
    if (ref.origin !== base.origin) return null;
    return normalizePathname(ref.pathname);
  } catch {
    return null;
  }
}

/** Safe redirect target when route access is denied. */
export function resolveDeniedRedirectTarget(
  ctx: RouteAccessContext,
  options: { referer?: string | null; origin?: string | null }
): string {
  const refererPath = parseRefererPath(options.referer, options.origin ?? null);
  if (refererPath && canAccessHref(refererPath, ctx)) {
    return refererPath;
  }

  if (canAccessHref("/", ctx)) return "/";

  const { teamCode, role, accessMode } = ctx;
  if (teamCode) {
    const hrefs = getTeamSidebarHrefs(ctx.granted, teamCode, role, accessMode);
    if (hrefs[0]) return hrefs[0];
  }

  const fallback = filterNavGroups(ctx.granted, { teamCode, role, accessMode }).flatMap((g) =>
    g.items.map((i) => i.href)
  );
  return fallback[0] ?? "/";
}

export function buildAppOrigin(headers: Headers): string | null {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return null;
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export type EnforceRouteAccessInput = RouteAccessContext & {
  pathname: string;
  referer?: string | null;
  origin?: string | null;
};

export function resolveRouteDeniedRedirect(input: EnforceRouteAccessInput): string | null {
  if (canAccessHref(input.pathname, input)) return null;
  return resolveDeniedRedirectTarget(input, {
    referer: input.referer,
    origin: input.origin,
  });
}
