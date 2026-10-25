import {
  requireAuth,
  authorize,
  ok,
  badRequest,
  notFound,
  forbidden,
  serverError,
} from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import {
  getUserAccessRoleAssignment,
  listAccessRoles,
  setUserAccessRoles,
  USER_ACCESS_MODES,
  type UserAccessMode,
} from "@/lib/services/access-role.service";
import { isInternalRole } from "@/lib/teams";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;

  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!user) return notFound();

  const [assignment, available] = await Promise.all([
    getUserAccessRoleAssignment(params.id),
    listAccessRoles(true),
  ]);

  if (!assignment) return notFound();

  return ok({
    accessMode: assignment.accessMode,
    assigned: assignment.accessRoles.map((uar) => ({
      id: uar.accessRole.id,
      code: uar.accessRole.code,
      name: uar.accessRole.name,
      sortOrder: uar.sortOrder,
      permissions: uar.accessRole.permissions.map((p) => p.permission.key),
    })),
    available: available.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      permissions: r.permissions.map((p) => p.permission.key),
    })),
  });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;

  if (auth!.user.role !== "SUPER_ADMIN") {
    return forbidden("Only Super Admin can change user access roles");
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) return notFound();
    if (!isInternalRole(existing.role)) {
      return badRequest("Access roles can only be assigned to internal employees");
    }
    if (existing.role === "SUPER_ADMIN") {
      return badRequest("Super Admin access cannot be customized");
    }

    const body = await req.json();
    const accessMode = String(body.accessMode ?? "INHERIT_ROLE") as UserAccessMode;
    if (!USER_ACCESS_MODES.includes(accessMode)) {
      return badRequest("accessMode must be INHERIT_ROLE or CUSTOM_ROLES");
    }
    const accessRoleIds = Array.isArray(body.accessRoleIds)
      ? body.accessRoleIds.map(String)
      : [];

    const before = await getUserAccessRoleAssignment(params.id);

    await setUserAccessRoles(params.id, accessMode, accessRoleIds);

    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.USER_ACCESS_CHANGED,
      entity: "User",
      entityId: params.id,
      before: {
        accessMode: before?.accessMode,
        accessRoleIds: before?.accessRoles.map((r) => r.accessRoleId) ?? [],
      },
      after: { accessMode, accessRoleIds },
    });

    return ok({ accessMode, accessRoleIds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update access roles";
    if (msg.includes("required") || msg.includes("invalid")) return badRequest(msg);
    return serverError(e);
  }
}
