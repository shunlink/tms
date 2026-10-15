import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, badRequest, unauthorized, notFound, serverError } from "@/lib/api";
import { driverSchema, validate } from "@/lib/validation";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.view");
  if (denied) return denied;
  try {
    const driver = await prisma.driver.findFirst({
      where: { id: params.id },
      include: { trips: true },
    });
    if (!driver) return notFound("Driver not found");
    return ok(driver);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.create");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(driverSchema.partial(), body);
    if (!parsed.success) return badRequest(parsed.error);

    const existing = await prisma.driver.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Driver not found");

    const data: Record<string, unknown> = { ...parsed.data, isActive: body.isActive };
    if (parsed.data.dlNumber) data.dlNumber = parsed.data.dlNumber.replace(/\s+/g, "").toUpperCase();

    const driver = await prisma.driver.update({ where: { id: params.id }, data });
    return ok(driver);
  } catch (e) {
    return serverError(e);
  }
}

// Soft-deactivate (historical traceability — no physical delete).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.create");
  if (denied) return denied;
  try {
    const existing = await prisma.driver.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Driver not found");
    await prisma.driver.update({
      where: { id: params.id },
      data: { isActive: false, deletedAt: new Date(), accountStatus: "SUSPENDED" },
    });
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
