import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, badRequest, forbidden, notFound, serverError } from "@/lib/api";
import { userUpdateSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { resolveEmployeeTeam } from "@/lib/services/employee.service";
import { isInternalRole } from "@/lib/teams";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;
  try {
    const existing = await prisma.user.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("User not found");

    const body = await req.json();
    const parsed = validate(userUpdateSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const nextRole = parsed.data.role ?? existing.role;

    if (
      (nextRole === "SUPER_ADMIN" || existing.role === "SUPER_ADMIN") &&
      auth!.user.role !== "SUPER_ADMIN"
    ) {
      return forbidden("Only a Super Admin can modify SUPER_ADMIN accounts");
    }

    const teamResult = await resolveEmployeeTeam(
      {
        role: nextRole,
        teamId: parsed.data.teamId !== undefined ? parsed.data.teamId : existing.teamId,
        clientId: parsed.data.clientId ?? existing.clientId,
        vendorId: parsed.data.vendorId ?? existing.vendorId,
        driverId: parsed.data.driverId ?? existing.driverId,
      },
      auth!.user.role ?? ""
    );
    if (!teamResult.ok) return badRequest(teamResult.error);

    if (parsed.data.employeeCode && parsed.data.employeeCode !== existing.employeeCode) {
      const codeTaken = await prisma.user.findFirst({
        where: { employeeCode: parsed.data.employeeCode, NOT: { id: params.id } },
      });
      if (codeTaken) return badRequest("Employee code already in use");
    }

    const data: Record<string, unknown> = {
      name: parsed.data.name,
      role: nextRole,
      teamId: teamResult.data.teamId,
      clientId: parsed.data.clientId,
      vendorId: parsed.data.vendorId,
      driverId: parsed.data.driverId,
      isActive: body.isActive,
    };

    if (isInternalRole(nextRole)) {
      if (parsed.data.employeeCode !== undefined) data.employeeCode = parsed.data.employeeCode;
      if (parsed.data.jobTitle !== undefined) data.jobTitle = parsed.data.jobTitle;
    } else {
      data.teamId = null;
      data.employeeCode = null;
      data.jobTitle = null;
    }

    if (parsed.data.password) {
      data.password = await bcrypt.hash(parsed.data.password, 10);
    }

    const user = await prisma.user.update({ where: { id: params.id }, data });
    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.EMPLOYEE_UPDATED,
      entity: "User",
      entityId: user.id,
      meta: { passwordReset: Boolean(parsed.data.password) },
      before: { role: existing.role, teamId: existing.teamId, isActive: existing.isActive },
      after: { role: user.role, teamId: user.teamId, isActive: user.isActive },
    });
    return ok({ id: user.id, email: user.email, role: user.role, teamId: user.teamId });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;
  if (auth!.user.id === params.id) return badRequest("You cannot deactivate your own account");
  try {
    const existing = await prisma.user.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("User not found");
    await prisma.user.update({ where: { id: params.id }, data: { isActive: false } });
    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.EMPLOYEE_DEACTIVATED,
      entity: "User",
      entityId: params.id,
      before: { isActive: true, email: existing.email },
      after: { isActive: false },
    });
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
