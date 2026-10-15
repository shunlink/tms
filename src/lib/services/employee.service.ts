import { prisma } from "../prisma";
import {
  isInternalRole,
  isRoleAllowedForTeam,
  validateEmployeeAssignment,
  type EmployeeAssignmentInput,
} from "../teams";

export type ResolvedEmployeeTeam = {
  teamId: string | null;
  teamCode: string | null;
};

/**
 * Resolves and validates team assignment for user create/update.
 * Returns error message when invalid.
 */
export async function resolveEmployeeTeam(
  input: EmployeeAssignmentInput,
  actorRole: string
): Promise<{ ok: true; data: ResolvedEmployeeTeam } | { ok: false; error: string }> {
  const check = validateEmployeeAssignment(input, actorRole);
  if (!check.ok) return check;

  if (!isInternalRole(input.role)) {
    return { ok: true, data: { teamId: null, teamCode: null } };
  }

  let team = null;
  if (input.teamId) {
    team = await prisma.team.findFirst({
      where: { id: input.teamId, isActive: true },
      select: { id: true, code: true },
    });
    if (!team) return { ok: false, error: "Invalid or inactive team" };
  } else if (input.teamCode) {
    team = await prisma.team.findFirst({
      where: { code: input.teamCode, isActive: true },
      select: { id: true, code: true },
    });
    if (!team) return { ok: false, error: "Invalid or inactive team" };
  }

  if (!team) {
    return { ok: false, error: "Internal employees must be assigned to a team" };
  }

  if (!isRoleAllowedForTeam(input.role, team.code)) {
    return { ok: false, error: `Role ${input.role} is not allowed for team ${team.code}` };
  }

  return { ok: true, data: { teamId: team.id, teamCode: team.code } };
}

export async function ensureDefaultTeams() {
  const teams = [
    { code: "ADMIN", name: "Admin", description: "Platform administration and escalation" },
    { code: "SALES", name: "Sales", description: "Client requirements and indent creation" },
    { code: "OPERATIONS", name: "Operations", description: "Trip execution, placement, and POD" },
    { code: "FINANCE", name: "Finance", description: "Advances, invoicing, and payments" },
    { code: "VENDOR_TEAM", name: "Vendor Team", description: "Vendor partner management" },
  ];

  for (const t of teams) {
    await prisma.team.upsert({
      where: { code: t.code },
      create: t,
      update: { name: t.name, description: t.description, isActive: true },
    });
  }
}

export async function listTeams() {
  return prisma.team.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
  });
}

/** Next sequential EMP### code for new internal employees. */
export async function suggestNextEmployeeCode() {
  const rows = await prisma.user.findMany({
    where: { employeeCode: { not: null } },
    select: { employeeCode: true },
  });
  let max = 0;
  for (const row of rows) {
    const match = row.employeeCode?.match(/^EMP(\d+)$/i);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `EMP${String(max + 1).padStart(3, "0")}`;
}
