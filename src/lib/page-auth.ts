import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActorSessionUser, getSessionUser } from "./auth";
import {
  buildAppOrigin,
  canAccessHref,
  normalizePathname,
  resolveDeniedRedirectTarget,
  type RouteAccessContext,
} from "./route-access";
import { hasPermission, type PermissionKey } from "./services/permission.service";
import type { UserAccessMode } from "./services/access-role.service";
import type { TeamCode } from "./teams";
import { isInternalRole } from "./teams";

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperAdminActor() {
  const actor = await getActorSessionUser();
  if (!actor || actor.role !== "SUPER_ADMIN") redirect("/");
  return actor;
}

/** Redirect portal users away from internal dashboard pages. */
export async function requireInternalSession() {
  const user = await requireSessionUser();
  if (!isInternalRole(user.role)) {
    if (user.role === "CLIENT") redirect("/portal/client");
    if (user.role === "VENDOR") redirect("/portal/vendor");
    if (user.role === "DRIVER") redirect("/driver");
    redirect("/login");
  }
  return user;
}

/** Server-side page guard — redirects to dashboard when permission is missing. */
export async function requirePagePermission(permission: PermissionKey) {
  const user = await requireInternalSession();
  const actor = await getActorSessionUser();
  const superBypass = actor?.role === "SUPER_ADMIN" && !user.portalAccessSessionId;
  if (superBypass) return user;
  if (!(await hasPermission(user.id!, permission))) redirect("/");
  return user;
}

/** Trip finance pages — user needs payment.view or invoice.view. */
export async function requireFinanceViewPermission() {
  const user = await requireInternalSession();
  const actor = await getActorSessionUser();
  const superBypass = actor?.role === "SUPER_ADMIN" && !user.portalAccessSessionId;
  if (superBypass) return user;
  const [canPayables, canReceivables] = await Promise.all([
    hasPermission(user.id!, "payment.view"),
    hasPermission(user.id!, "invoice.view"),
  ]);
  if (!canPayables && !canReceivables) redirect("/");
  return user;
}

export type DashboardRouteAccessInput = {
  pathname: string;
  granted: Set<string>;
  teamCode?: TeamCode;
  role: string;
  accessMode: UserAccessMode;
  portalAccessSessionId?: string;
};

/** Central dashboard route gate — redirects when href is not allowed for this user. */
export async function enforceDashboardRouteAccess(input: DashboardRouteAccessInput) {
  const actor = await getActorSessionUser();
  const superBypass = actor?.role === "SUPER_ADMIN" && !input.portalAccessSessionId;

  const ctx: RouteAccessContext = {
    granted: input.granted,
    teamCode: input.teamCode,
    role: input.role,
    accessMode: input.accessMode,
    superBypass,
  };

  const path = normalizePathname(input.pathname);
  if (canAccessHref(path, ctx)) return;

  const hdrs = headers();
  const target = resolveDeniedRedirectTarget(ctx, {
    referer: hdrs.get("referer"),
    origin: buildAppOrigin(hdrs),
  });
  redirect(target);
}
