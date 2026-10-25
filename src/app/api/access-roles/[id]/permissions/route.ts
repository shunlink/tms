import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { PERMISSION_KEYS, ensurePermissionRowsForKeys } from "@/lib/services/permission.service";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "roles.manage");
  if (denied) return denied;

  const role = await prisma.accessRole.findUnique({
    where: { id: params.id },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) return notFound();

  return ok({
    id: role.id,
    permissions: role.permissions.map((p) => p.permission.key),
  });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "roles.manage");
  if (denied) return denied;

  try {
    const role = await prisma.accessRole.findUnique({
      where: { id: params.id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) return notFound();

    const body = await req.json();
    const keys: string[] = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
    const invalid = keys.filter(
      (k: string) => !PERMISSION_KEYS.includes(k as (typeof PERMISSION_KEYS)[number])
    );
    if (invalid.length) return badRequest(`Unknown permissions: ${invalid.join(", ")}`);

    await ensurePermissionRowsForKeys(keys);

    const beforeKeys = role.permissions.map((p) => p.permission.key);

    await prisma.$transaction(async (tx) => {
      await tx.accessRolePermission.deleteMany({ where: { accessRoleId: params.id } });
      const perms = await tx.permission.findMany({ where: { key: { in: keys } } });
      const foundKeys = new Set(perms.map((p) => p.key));
      const missingInDb = keys.filter((k: string) => !foundKeys.has(k));
      if (missingInDb.length) {
        throw new Error(`Permission rows missing in database: ${missingInDb.join(", ")}`);
      }
      for (const p of perms) {
        await tx.accessRolePermission.create({
          data: { accessRoleId: params.id, permissionId: p.id },
        });
      }
    });

    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.ACCESS_ROLE_CHANGED,
      entity: "AccessRole",
      entityId: params.id,
      before: { permissions: beforeKeys },
      after: { permissions: keys },
      meta: { operation: "set_permissions" },
    });

    return ok({ id: params.id, permissions: keys });
  } catch (e) {
    return serverError(e);
  }
}
