import { registerPortalUser } from "@/lib/services/signup.service";
import { signupSchema, validate, zodFieldErrors } from "@/lib/validation";
import { badRequest, created, serverError } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { friendlyValidationError } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = validate(signupSchema, body);
    if (!parsed.success) {
      return badRequest(friendlyValidationError(parsed.error), {
        code: "VALIDATION_ERROR",
        fieldErrors: zodFieldErrors(signupSchema.safeParse(body).error?.issues ?? []),
      });
    }

    const rateKey = parsed.data.email ?? parsed.data.phone;
    const rl = rateLimit(`signup:${rateKey.toLowerCase()}`, 5, 15 * 60_000);
    if (!rl.ok) return badRequest("Too many signup attempts. Please try again later.");

    const account = await registerPortalUser(parsed.data);
    return created(account);
  } catch (e) {
    if (e instanceof Error) {
      if (
        e.message.includes("already exists") ||
        e.message.includes("already registered")
      ) {
        return badRequest(e.message);
      }
    }
    return serverError(e);
  }
}
