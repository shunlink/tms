import { z } from "zod";
import { requireAuth, ok, badRequest, forbidden, serverError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { denySuperAdminOnboardingOps } from "@/lib/onboarding-ops-access";
import { assignClientOnboardingToEmployee } from "@/lib/services/onboarding.service";
import { validate } from "@/lib/validation";

export const runtime = "nodejs";

const assignSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required"),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const auth = await requireAuth();
  const superAdminDenied = denySuperAdminOnboardingOps(auth);
  if (superAdminDenied) return superAdminDenied;
  if (auth!.user.role !== "SUPER_ADMIN") {
    return forbidden("Only Super Admin can assign onboarding requests");
  }

  try {
    const body = await req.json();
    const parsed = validate(assignSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const case_ = await assignClientOnboardingToEmployee(params.clientId, parsed.data.employeeId);
    await logAudit({
      user: auth!.user,
      action: "onboarding.request.assign",
      entity: "Client",
      entityId: params.clientId,
      meta: { employeeId: parsed.data.employeeId },
    });
    return ok({ status: case_.status, assignedEmployeeId: case_.assignedEmployeeId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to assign onboarding request";
    if (message.includes("Only partial") || message.includes("Assignee must")) {
      return badRequest(message);
    }
    return serverError(e);
  }
}
