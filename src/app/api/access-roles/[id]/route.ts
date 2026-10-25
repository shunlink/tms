import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "roles.manage");
  if (denied) return denied;

  try {
    const existing = await prisma.accessRole.findUnique({ where: { id: params.id } });
    if (!existing) return notFound();

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

    const role = await prisma.accessRole.update({ where: { id: params.id }, data });

    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.ACCESS_ROLE_CHANGED,
      entity: "AccessRole",
      entityId: role.id,
      before: { name: existing.name, isActive: existing.isActive },
      after: { name: role.name, isActive: role.isActive },
      meta: { operation: "update" },
    });

    return ok(role);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "roles.manage");
  if (denied) return denied;

  try {
    const existing = await prisma.accessRole.findUnique({
      where: { id: params.id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) return notFound();
    if (existing._count.users > 0) {
      return badRequest("Cannot delete an access role that is assigned to users. Deactivate it instead.");
    }

    await prisma.accessRole.delete({ where: { id: params.id } });

    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.ACCESS_ROLE_CHANGED,
      entity: "AccessRole",
      entityId: params.id,
      before: { code: existing.code, name: existing.name },
      meta: { operation: "delete" },
    });

    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
