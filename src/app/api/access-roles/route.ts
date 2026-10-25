import { requireAuth, authorize, ok, badRequest, serverError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { listAccessRoles } from "@/lib/services/access-role.service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "roles.manage");
  if (denied) return denied;

  try {
    const roles = await listAccessRoles(false);
    return ok({
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
        userCount: r._count.users,
        permissions: r.permissions.map((p) => p.permission.key),
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "roles.manage");
  if (denied) return denied;

  try {
    const body = await req.json();
    const code = String(body.code ?? "").trim().toUpperCase().replace(/\s+/g, "_");
    const name = String(body.name ?? "").trim();
    if (!code || !name) return badRequest("code and name are required");

    const existing = await prisma.accessRole.findUnique({ where: { code } });
    if (existing) return badRequest("Access role code already exists");

    const role = await prisma.accessRole.create({
      data: {
        code,
        name,
        description: body.description ? String(body.description) : null,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      },
    });

    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.ACCESS_ROLE_CHANGED,
      entity: "AccessRole",
      entityId: role.id,
      after: { code: role.code, name: role.name },
      meta: { operation: "create" },
    });

    return ok(role);
  } catch (e) {
    return serverError(e);
  }
}
