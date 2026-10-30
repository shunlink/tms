import { headers } from "next/headers";

import { created, badRequest, serverError } from "@/lib/api";
import { friendlyValidationError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/ratelimit";
import { registerDriverMobileSignup } from "@/lib/services/driver.service";
import { driverMobileSignupSchema, validate, zodFieldErrors } from "@/lib/validation";

export const runtime = "nodejs";

function clientIp(): string | null {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
}

/**
 * Public driver self-registration for Shunlink Sarathi.
 * No auth session required — same class of endpoint as POST /api/drivers/otp/request.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp() ?? "unknown";
    const rl = rateLimit(`driver-register:${ip}`, 8, 60 * 60 * 1000);
    if (!rl.ok) {
      return badRequest(`Too many registration attempts. Try again in ${rl.retryAfter} seconds.`, {
        code: "RATE_LIMITED",
        retryAfter: rl.retryAfter,
      });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = validate(driverMobileSignupSchema, body);
    if (!parsed.success) {
      return badRequest(friendlyValidationError(parsed.error), {
        code: "VALIDATION_ERROR",
        fieldErrors: zodFieldErrors(driverMobileSignupSchema.safeParse(body).error?.issues ?? []),
      });
    }

    const driver = await registerDriverMobileSignup(parsed.data);

    return created({
      success: true,
      message: "Registration successful. Log in with your DL number and OTP.",
      driver,
    });
  } catch (e) {
    return serverError(e);
  }
}
