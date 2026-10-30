import { registerDriverMobile } from "@/lib/services/driver.service";
import { driverMobileRegisterSchema, validate, zodFieldErrors } from "@/lib/validation";
import { badRequest, created, serverError } from "@/lib/api";
import { friendlyValidationError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/ratelimit";
import { headers } from "next/headers";

export const runtime = "nodejs";

function clientIp(): string | null {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
}

/** Public self-registration for Shunlink Sarathi (DL must be unique). */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(driverMobileRegisterSchema, body);
    if (!parsed.success) {
      return badRequest(friendlyValidationError(parsed.error), {
        code: "VALIDATION_ERROR",
        fieldErrors: zodFieldErrors(
          driverMobileRegisterSchema.safeParse(body).error?.issues ?? []
        ),
      });
    }

    const ip = clientIp();
    const rlKey = `${parsed.data.dlNumber}:${ip ?? "unknown"}`;
    const rl = rateLimit(`driver-register:${rlKey.toLowerCase()}`, 8, 15 * 60_000);
    if (!rl.ok) {
      return badRequest("Too many registration attempts. Please try again later.");
    }

    const driver = await registerDriverMobile(parsed.data);
    return created({
      id: driver.id,
      name: driver.name,
      dlNumber: driver.dlNumber,
      message: "Registration successful. Log in with OTP on your mobile number.",
    });
  } catch (e) {
    return serverError(e);
  }
}
