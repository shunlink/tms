import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, created, badRequest, serverError, safeOk } from "@/lib/api";
import { vendorSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { updateVendorProfile } from "@/lib/services/profile.service";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vendor.view");
  if (denied) return denied;
  return safeOk(
    "vendors.list",
    () =>
      prisma.vendor.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { vehicles: true, trips: true, payments: true } } },
      }),
    []
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vendor.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(vendorSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const vendor = await prisma.vendor.create({
      data: {
        name: d.name,
        type: d.type,
        contactName: d.contactName,
        phone: d.phone,
        altPhone: d.altPhone,
        email: d.email,
        whatsapp: d.whatsapp,
        gstin: d.gstin,
        pan: d.pan,
        msme: d.msme,
        notes: d.notes,
      },
    });
    await updateVendorProfile(vendor.id, d);
    await logAudit({ user: auth!.user, action: "vendor.create", entity: "Vendor", entityId: vendor.id, meta: { name: vendor.name, type: vendor.type } });
    return created(vendor);
  } catch (e) {
    return serverError(e);
  }
}
