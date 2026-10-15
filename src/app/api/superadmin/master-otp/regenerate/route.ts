import { z } from "zod";
import { handleApi, ok, badRequest } from "@/lib/api";
import { requireSuperAdminApi } from "@/lib/superadmin/require-superadmin-api";
import { regenerateMasterOtp } from "@/lib/superadmin/master-otp.service";

const bodySchema = z.object({
  password: z.string().min(1),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return badRequest("Password is required to regenerate the Master OTP");
    }

    const result = await regenerateMasterOtp(auth.actor, parsed.data.password);
    if (!result.ok) return badRequest(result.error);

    return ok({
      masterOtp: result.plaintext,
      generatedAt: result.generatedAt,
    });
  });
}
