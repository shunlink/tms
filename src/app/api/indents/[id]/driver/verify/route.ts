import { z } from "zod";
import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { otpSchema, validate, zodFieldErrors } from "@/lib/validation";
import { verifyDriverForIndent } from "@/lib/services/driver.service";
import { friendlyValidationError } from "@/lib/api-errors";

const indentDriverVerifySchema = z.object({
  driverId: z.string().min(1, "Driver id is required"),
  otp: otpSchema,
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "driver.verify");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(indentDriverVerifySchema, body);
    if (!parsed.success) {
      return badRequest(friendlyValidationError(parsed.error), {
        code: "VALIDATION_ERROR",
        fieldErrors: zodFieldErrors(indentDriverVerifySchema.safeParse(body).error?.issues ?? []),
      });
    }

    const indent = await verifyDriverForIndent(
      params.id,
      parsed.data.driverId,
      parsed.data.otp,
      auth!.user
    );
    if (!indent) return notFound("Indent not found");
    return ok(indent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    if (
      msg.includes("Invalid or expired") ||
      msg.includes("Vehicle and driver") ||
      msg.includes("Vendor must be allocated")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
