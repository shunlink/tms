import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, created, badRequest, serverError, safeOk } from "@/lib/api";
import { userSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { resolveEmployeeTeam } from "@/lib/services/employee.service";
import { isInternalRole } from "@/lib/teams";

function safeUser(u: {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  teamId: string | null;
  employeeCode: string | null;
  jobTitle: string | null;
  clientId: string | null;
  vendorId: string | null;
  driverId: string | null;
  createdAt: Date;
  team?: { code: string; name: string } | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    teamId: u.teamId,
    teamCode: u.team?.code ?? null,
    teamName: u.team?.name ?? null,
    employeeCode: u.employeeCode,
    jobTitle: u.jobTitle,
    clientId: u.clientId,
    vendorId: u.vendorId,
    driverId: u.driverId,
    createdAt: u.createdAt,
  };
}

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;
  return safeOk(
    "users.list",
    async () => {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: { team: { select: { code: true, name: true } } },
      });
      return users.map(safeUser);
    },
    []
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(userSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const teamResult = await resolveEmployeeTeam(
      {
        role: parsed.data.role,
        teamId: parsed.data.teamId,
        clientId: parsed.data.clientId,
        vendorId: parsed.data.vendorId,
        driverId: parsed.data.driverId,
      },
      auth!.user.role ?? ""
    );
    if (!teamResult.ok) return badRequest(teamResult.error);

    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) return badRequest("A user with this email already exists");

    if (parsed.data.employeeCode) {
      const codeTaken = await prisma.user.findFirst({ where: { employeeCode: parsed.data.employeeCode } });
      if (codeTaken) return badRequest("Employee code already in use");
    }

    const password = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        password,
        role: parsed.data.role,
        teamId: teamResult.data.teamId,
        employeeCode: isInternalRole(parsed.data.role) ? parsed.data.employeeCode : null,
        jobTitle: isInternalRole(parsed.data.role) ? parsed.data.jobTitle : null,
        clientId: parsed.data.clientId,
        vendorId: parsed.data.vendorId,
        driverId: parsed.data.driverId,
      },
      include: { team: { select: { code: true, name: true } } },
    });
    const { AUDIT_ACTIONS } = await import("@/lib/audit-actions");
    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.EMPLOYEE_CREATED,
      entity: "User",
      entityId: user.id,
      meta: { email: user.email, role: user.role, teamCode: user.team?.code },
      after: { name: user.name, role: user.role, teamId: user.teamId, employeeCode: user.employeeCode },
    });
    return created(safeUser(user));
  } catch (e) {
    return serverError(e);
  }
}
