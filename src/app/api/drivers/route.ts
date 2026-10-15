import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, created, badRequest, unauthorized, serverError, safeOk } from "@/lib/api";
import { driverSchema, validate } from "@/lib/validation";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.view");
  if (denied) return denied;
  return safeOk(
    "drivers.list",
    () =>
      prisma.driver.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { trips: true } } },
      }),
    []
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.create");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(driverSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const dlNumber = parsed.data.dlNumber.replace(/\s+/g, "").toUpperCase();
    const driver = await prisma.driver.create({
      data: { ...parsed.data, dlNumber },
    });
    return created(driver);
  } catch (e) {
    return serverError(e);
  }
}
