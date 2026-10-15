import { badRequest, created, serverError } from "@/lib/api";
import { friendlyValidationError } from "@/lib/api-errors";
import { requestPasswordResetOtp } from "@/lib/services/password-reset.service";
import { forgotPasswordRequestSchema, validate } from "@/lib/validation";
import { headers } from "next/headers";

export const runtime = "nodejs";

function clientIp(): string | null {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
}

/**
 * Public endpoint: email a 6-digit password-reset code.
 *
 * The response is intentionally identical for known and unknown addresses so the
 * endpoint cannot be used to enumerate registered emails.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(forgotPasswordRequestSchema, body);
    if (!parsed.success) return badRequest(friendlyValidationError(parsed.error));

    await requestPasswordResetOtp(parsed.data.email, clientIp());

    return created({
      message: "If an account exists for this email, a reset code has been sent.",
    });
  } catch (e) {
    return serverError(e);
  }
}
