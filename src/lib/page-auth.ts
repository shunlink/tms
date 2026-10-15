import { redirect } from "next/navigation";
import { getActorSessionUser, getSessionUser } from "./auth";
import { hasPermission, type PermissionKey } from "./services/permission.service";
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
