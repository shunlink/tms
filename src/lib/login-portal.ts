export const INTERNAL_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES",
  "OPERATIONS",
  "FINANCE",
  "VENDOR_TEAM",
] as const;

export type LoginPortal = "client" | "employee" | "vendor" | "driver";

export const LOGIN_PORTAL_MISMATCH_MESSAGE =
  "This account isn't authorized for this sign-in page. Please use the portal that matches your account type.";

export function roleMatchesLoginPortal(role: string, portal: LoginPortal): boolean {
  if (portal === "client") return role === "CLIENT";
  if (portal === "vendor") return role === "VENDOR";
  if (portal === "employee") return INTERNAL_ROLES.includes(role as (typeof INTERNAL_ROLES)[number]);
  if (portal === "driver") return role === "DRIVER";
  return false;
}

/** Map legacy `?portal=` query values to login portal id. */
export function loginPortalFromLegacyQuery(portal: string | null | undefined): LoginPortal | undefined {
  if (portal === "client") return "client";
  if (portal === "employee") return "employee";
  if (portal === "transporter" || portal === "vendor") return "vendor";
  return undefined;
}
