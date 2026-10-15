import { badRequest, ok, serverError } from "@/lib/api";
import { friendlyValidationError } from "@/lib/api-errors";
import { resetPasswordWithOtp } from "@/lib/services/password-reset.service";
import { forgotPasswordResetSchema, validate } from "@/lib/validation";

export const runtime = "nodejs";

/** Public endpoint: verify the emailed OTP and set the new password. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(forgotPasswordResetSchema, body);
    if (!parsed.success) return badRequest(friendlyValidationError(parsed.error));

    await resetPasswordWithOtp(parsed.data.email, parsed.data.otp, parsed.data.newPassword);

    return ok({ message: "Password reset successfully. You can now sign in." });
  } catch (e) {
    return serverError(e);
  }
}
