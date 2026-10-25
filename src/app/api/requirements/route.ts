import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/sequence";
import { requireAuth, authorize, ok, created, badRequest, unauthorized, serverError, safeOk } from "@/lib/api";
import { requirementSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { denyUnapprovedClientMutation } from "@/lib/client-portal-mutation-guard";

function combineDateTime(date?: Date | null, time?: string | null): Date | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (time) {
    const [h, m] = time.split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  return d;
}

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "requirement.view");
  if (denied) return denied;
  return safeOk(
    "requirements.list",
    () =>
      prisma.requirement.findMany({
        orderBy: { createdAt: "desc" },
        include: { client: { select: { name: true } }, indent: { select: { id: true, indentNumber: true, status: true } } },
      }),
    []
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  // Client portal: middleware allowlist; internal staff: requirement.create
  if (auth.user.role !== "CLIENT") {
    const denied = await authorize(auth, "requirement.create");
    if (denied) return denied;
  } else {
    const viewOnlyDenied = await denyUnapprovedClientMutation(auth);
    if (viewOnlyDenied) return viewOnlyDenied;
  }
  try {
    const body = await req.json();
    const parsed = validate(requirementSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const clientId = auth.user.role === "CLIENT" ? auth.user.clientId : parsed.data.clientId;
    if (!clientId) return badRequest("clientId is required");

    // A client must specify the rate they are willing to pay so it carries into the indent.
    if (auth.user.role === "CLIENT" && parsed.data.clientRate == null) {
      return badRequest("Client rate is required");
    }

    const d = parsed.data;
    const reqNumber = await nextNumber("REQ");
    const requirement = await prisma.requirement.create({
      data: {
        reqNumber,
        clientId,
        routeFrom: d.routeFrom,
        routeTo: d.routeTo,
        vehicleTypeCode: d.vehicleType,
        vehicleQuantity: d.quantity,
        cargoSummary: d.cargoDetails,
        expectedAt: d.expectedDate,
        clientRate: d.clientRate,
        status: "OPEN",
        bodyTypeCode: d.bodyType,
        insuranceType: d.insuranceType,
        cargoTypeCode: d.cargoType,
        capacityCbm: d.capacityCbm,
        weightValue: d.weightValue,
        weightUnit: d.weightUnit,
        packageCount: d.packageCount,
        materialDescription: d.materialDescription,
        packingType: d.packingType,
        materialValue: d.materialValue,
        hsnCode: d.hsnCode,
        freightType: d.freightType,
        paymentMode: d.paymentMode,
        pickupAt: combineDateTime(d.pickupDate, d.pickupTime),
        deliveryAt: combineDateTime(d.deliveryDate, d.deliveryTime),
        specialInstructions: d.specialInstructions,
        consignorName: d.consignorName,
        consignorCity: d.consignorCity,
        consignorState: d.consignorState,
        consignorPincode: d.consignorPincode,
        consignorAddress: d.consignorAddress,
        consignorContact: d.consignorContact,
        consignorPhone: d.consignorPhone,
        consigneeName: d.consigneeName,
        consigneeCity: d.consigneeCity,
        consigneeState: d.consigneeState,
        consigneePincode: d.consigneePincode,
        consigneeAddress: d.consigneeAddress,
        consigneeContact: d.consigneeContact,
        consigneePhone: d.consigneePhone,
      },
    });
    await logAudit({
      user: auth!.user,
      action: AUDIT_ACTIONS.CREATED_REQUIREMENT,
      entity: "Requirement",
      entityId: requirement.id,
      meta: { reqNumber },
      after: { status: requirement.status, routeFrom: requirement.routeFrom, routeTo: requirement.routeTo },
    });
    return created(requirement);
  } catch (e) {
    return serverError(e);
  }
}
