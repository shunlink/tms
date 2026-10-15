import type { PermissionKey } from "../permissions";
import type { AuthContext } from "../auth-context";

/** Permissions blocked while Superadmin is viewing an employee portal. */
export const IMPERSONATION_BLOCKED_PERMISSIONS = new Set<PermissionKey>([
  "payment.process",
  "payment.create",
  "client.payment.manage",
  "users.manage",
  "roles.manage",
  "permissions.manage",
  "accounting.period.close",
  "accounting.period.reopen",
  "financial_note.approve",
  "financial_note.issue",
  "financial_note.reverse",
]);

export function isImpersonationBlockedPermission(permission: PermissionKey): boolean {
  return IMPERSONATION_BLOCKED_PERMISSIONS.has(permission);
}

export function impersonationBlocksPermission(
  auth: AuthContext | null,
  permission?: PermissionKey
): boolean {
  if (!auth?.impersonation || !permission) return false;
  return isImpersonationBlockedPermission(permission);
}
