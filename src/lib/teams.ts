/** Internal employee team codes — multiple employees per team. */
export const TEAM_CODES = [
  "ADMIN",
  "SALES",
  "OPERATIONS",
  "FINANCE",
  "VENDOR_TEAM",
] as const;

export type TeamCode = (typeof TEAM_CODES)[number];

/** Roles that belong to the internal dashboard (not portal users). */
export const INTERNAL_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES",
  "OPERATIONS",
  "FINANCE",
  "VENDOR_TEAM",
] as const;

export type InternalRole = (typeof INTERNAL_ROLES)[number];

export const PORTAL_ROLES = ["CLIENT", "VENDOR", "DRIVER"] as const;

/** Which user roles are valid for each team. */
export const TEAM_ALLOWED_ROLES: Record<TeamCode, readonly string[]> = {
  ADMIN: ["SUPER_ADMIN", "ADMIN"],
  SALES: ["SALES"],
  OPERATIONS: ["OPERATIONS"],
  FINANCE: ["FINANCE"],
  VENDOR_TEAM: ["VENDOR_TEAM"],
};

/** Default team when assigning by role alone (e.g. seed / migration). */
export const ROLE_DEFAULT_TEAM: Record<string, TeamCode> = {
  SUPER_ADMIN: "ADMIN",
  ADMIN: "ADMIN",
  SALES: "SALES",
  OPERATIONS: "OPERATIONS",
  FINANCE: "FINANCE",
  VENDOR_TEAM: "VENDOR_TEAM",
};

export function isInternalRole(role?: string | null): boolean {
  return INTERNAL_ROLES.includes(role as InternalRole);
}

export function isPortalRole(role?: string | null): boolean {
  return PORTAL_ROLES.includes(role as (typeof PORTAL_ROLES)[number]);
}

export function isRoleAllowedForTeam(role: string, teamCode: string): boolean {
  const allowed = TEAM_ALLOWED_ROLES[teamCode as TeamCode];
  if (!allowed) return false;
  return allowed.includes(role);
}

export type EmployeeAssignmentInput = {
  role: string;
  teamId?: string | null;
  teamCode?: string | null;
  clientId?: string | null;
  vendorId?: string | null;
  driverId?: string | null;
};

export type EmployeeAssignmentResult =
  | { ok: true; teamId: string | null }
  | { ok: false; error: string };

/**
 * Validates internal employee team ↔ role assignment server-side.
 * Portal users (CLIENT/VENDOR/DRIVER) must not have a team.
 */
export function validateEmployeeAssignment(
  input: EmployeeAssignmentInput,
  actorRole: string
): EmployeeAssignmentResult {
  const { role, teamId, teamCode, clientId, vendorId, driverId } = input;

  if (isPortalRole(role)) {
    if (teamId) return { ok: false, error: "Portal users cannot belong to an internal team" };
    if (role === "CLIENT" && !clientId) return { ok: false, error: "Client users must be linked to a client" };
    if (role === "VENDOR" && !vendorId) return { ok: false, error: "Vendor users must be linked to a vendor" };
    if (role === "DRIVER" && !driverId) return { ok: false, error: "Driver users must be linked to a driver" };
    return { ok: true, teamId: null };
  }

  if (!isInternalRole(role)) {
    return { ok: false, error: `Unknown role: ${role}` };
  }

  if (role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
    return { ok: false, error: "Only a Super Admin can assign the SUPER_ADMIN role" };
  }

  if (role === "ADMIN" && actorRole !== "SUPER_ADMIN" && actorRole !== "ADMIN") {
    return { ok: false, error: "Only Admin or Super Admin can assign the ADMIN role" };
  }

  if (!teamId && !teamCode) {
    return { ok: false, error: "Internal employees must be assigned to a team" };
  }

  if (teamCode && !isRoleAllowedForTeam(role, teamCode)) {
    return { ok: false, error: `Role ${role} is not allowed for team ${teamCode}` };
  }

  // teamId validation against teamCode happens in service layer (DB lookup)
  return { ok: true, teamId: teamId ?? null };
}
