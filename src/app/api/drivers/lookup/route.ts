import { requireAuth, authorize, ok, badRequest, serverError } from "@/lib/api";
import { lookupDriverByDl } from "@/lib/services/driver.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.view");
  if (denied) return denied;

  try {
    const dl = new URL(req.url).searchParams.get("dl");
    if (!dl?.trim()) return badRequest("DL number is required");

    const driver = await lookupDriverByDl(dl);
    if (!driver) return ok({ found: false });

    return ok({
      found: true,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        dlNumber: driver.dlNumber,
        deviceType: driver.deviceType,
        otpVerified: driver.otpVerified,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
