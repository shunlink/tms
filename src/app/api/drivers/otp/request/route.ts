import { requestDriverOtp } from "@/lib/services/driver.service";
import { driverLoginOtpRequestSchema, validate, zodFieldErrors } from "@/lib/validation";
import { badRequest, created, serverError } from "@/lib/api";
import { friendlyValidationError } from "@/lib/api-errors";
import { headers } from "next/headers";

export const runtime = "nodejs";

function clientIp(): string | null {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
}

/**
 * Public OTP request for driver login. Identity = DL number + registered phone.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(driverLoginOtpRequestSchema, body);
    if (!parsed.success) {
      return badRequest(friendlyValidationError(parsed.error), {
        code: "VALIDATION_ERROR",
        fieldErrors: zodFieldErrors(
          driverLoginOtpRequestSchema.safeParse(body).error?.issues ?? []
        ),
      });
    }

    const result = await requestDriverOtp(
      parsed.data.dlNumber,
      parsed.data.phone,
      clientIp()
    );
    return created({ ...result, message: "OTP sent successfully." });
  } catch (e) {
    return serverError(e);
  }
}
