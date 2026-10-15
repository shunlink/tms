import { requireAuth, authorize, ok, badRequest, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { listPermissions, getGrantedPermissions, DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS } from "@/lib/services/permission.service";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "permissions.manage");
  if (denied) return denied;

  const permissions = await listPermissions();
  const roles = ["ADMIN", "SALES", "OPERATIONS", "FINANCE", "CLIENT", "VENDOR", "DRIVER"];

  const roleMatrix: Record<string, string[]> = {};
  for (const role of roles) {
    const rps = await prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
    });
    roleMatrix[role] =
      rps.length > 0 ? rps.map((r) => r.permission.key) : DEFAULT_ROLE_PERMISSIONS[role] ?? [];
  }

  return ok({ permissions: PERMISSION_KEYS, roles, roleMatrix });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "permissions.manage");
  if (denied) return denied;

  try {
    const body = await req.json();
    const role = String(body.role ?? "");
    const grantedKeys = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
    if (!role) return badRequest("role is required");

    const previous = await prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
    });
    const beforeKeys =
      previous.length > 0
        ? previous.map((r) => r.permission.key)
        : DEFAULT_ROLE_PERMISSIONS[role] ?? [];

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role } });
      const perms = await tx.permission.findMany({ where: { key: { in: grantedKeys } } });
      for (const p of perms) {
        await tx.rolePermission.create({ data: { role, permissionId: p.id } });
      }
    });

    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.PERMISSION_CHANGED,
      entity: "RolePermission",
      entityId: role,
      before: { permissions: beforeKeys },
      after: { permissions: grantedKeys },
      meta: { role },
    });

    const granted = await getGrantedPermissions(auth!.user.id);
    return ok({ role, permissions: Array.from(granted) });
  } catch (e) {
    return serverError(e);
  }
}
