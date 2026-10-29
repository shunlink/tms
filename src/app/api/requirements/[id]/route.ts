import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { z } from "zod";
import { requirementSchema, validate } from "@/lib/validation";

const requirementPatchSchema = requirementSchema.partial().extend({
  status: z.enum(["OPEN", "CONVERTED", "CANCELLED"]).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "requirement.view");
  if (denied) return denied;
  try {
    const requirement = await prisma.requirement.findFirst({
      where: { id: params.id },
      include: { client: true, indent: true },
    });
    if (!requirement) return notFound("Requirement not found");
    return ok(requirement);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "requirement.create");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(requirementPatchSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const existing = await prisma.requirement.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Requirement not found");

    const requirement = await prisma.requirement.update({
      where: { id: params.id },
      data: {
        routeFrom: d.routeFrom,
        routeTo: d.routeTo,
        vehicleTypeCode: d.vehicleType,
        vehicleQuantity: d.quantity,
        cargoSummary: d.cargoDetails,
        expectedAt: d.expectedDate,
        clientRate: d.clientRate,
        status: d.status,
      },
    });

    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.UPDATED_REQUIREMENT,
      entity: "Requirement",
      entityId: requirement.id,
      before: {
        status: existing.status,
        routeFrom: existing.routeFrom,
        routeTo: existing.routeTo,
        clientRate: existing.clientRate?.toString() ?? null,
      },
      after: {
        status: requirement.status,
        routeFrom: requirement.routeFrom,
        routeTo: requirement.routeTo,
        clientRate: requirement.clientRate?.toString() ?? null,
      },
    });

    return ok(requirement);
  } catch (e) {
    return serverError(e);
  }
}
