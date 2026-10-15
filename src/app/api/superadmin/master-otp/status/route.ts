import { handleApi, ok } from "@/lib/api";
import { requireSuperAdminApi } from "@/lib/superadmin/require-superadmin-api";
import { getMasterOtpStatus } from "@/lib/superadmin/master-otp.service";

export async function GET() {
  return handleApi(async () => {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    const status = await getMasterOtpStatus();
    return ok(status);
  });
}
