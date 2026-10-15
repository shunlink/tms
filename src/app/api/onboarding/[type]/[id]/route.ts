import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { onboardingDecisionSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { reviewOnboarding, type OnboardingEntityType } from "@/lib/services/onboarding.service";
import { getOnboardingApplicationSnapshot } from "@/lib/queries";
import { prisma } from "@/lib/prisma";

const TYPE_MAP: Record<string, OnboardingEntityType> = {
  client: "CLIENT",
  vendor: "VENDOR",
  driver: "DRIVER",
  vehicle: "VEHICLE",
};

export async function GET(_req: Request, { params }: { params: { type: string; id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;

  try {
    const entityType = TYPE_MAP[params.type];
    if (!entityType) return notFound("Unknown onboarding type");

    const snapshot = await getOnboardingApplicationSnapshot(params.type, params.id);
    if (!snapshot) return notFound("Application not found");
    return ok(snapshot);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { type: string; id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;

  try {
    const body = await req.json();
    const parsed = validate(onboardingDecisionSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const entityType = TYPE_MAP[params.type];
    if (!entityType) return notFound("Unknown onboarding type");

    const status = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
    await reviewOnboarding(entityType, params.id, status, auth!.user.id, parsed.data.remarks);

    if (entityType === "VEHICLE" && status === "APPROVED") {
      await prisma.vehicleCompliance.updateMany({
        where: { vehicleId: params.id },
        data: { verificationStatus: "APPROVED", verifiedAt: new Date(), verifiedById: auth!.user.id },
      });
    }

    await logAudit({
      user: auth!.user,
      action: `onboarding.${parsed.data.action}`,
      entity: params.type,
      entityId: params.id,
      meta: { remarks: parsed.data.remarks },
    });
    return ok({ status });
  } catch (e) {
    return serverError(e);
  }
}
