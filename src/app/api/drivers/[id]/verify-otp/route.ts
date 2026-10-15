import { requireAuth, authorize, ok, badRequest, serverError } from "@/lib/api";
import { driverOtpVerifySchema, validate, zodFieldErrors } from "@/lib/validation";
import { verifyDriverOtp } from "@/lib/services/driver.service";
import { friendlyValidationError } from "@/lib/api-errors";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.verify");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(driverOtpVerifySchema, body);
    if (!parsed.success) {
      return badRequest(friendlyValidationError(parsed.error), {
        code: "VALIDATION_ERROR",
        fieldErrors: zodFieldErrors(driverOtpVerifySchema.safeParse(body).error?.issues ?? []),
      });
    }

    const result = await verifyDriverOtp(params.id, parsed.data.otp);
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
