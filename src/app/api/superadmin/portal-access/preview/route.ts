import { z } from "zod";
import { handleApi, ok, badRequest } from "@/lib/api";
import { requireSuperAdminApi } from "@/lib/superadmin/require-superadmin-api";
import { previewPortalAccessTarget } from "@/lib/superadmin/portal-access-session.service";

const bodySchema = z.object({
  identifier: z.string().min(1),
  masterOtp: z.string().min(1),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const result = await previewPortalAccessTarget(
      auth.actor.id,
      parsed.data.identifier,
      parsed.data.masterOtp
    );
    if (!result.ok) return badRequest(result.error);

    return ok({ target: result.target });
  });
}
