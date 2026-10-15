import { z } from "zod";
import { handleApi, ok, badRequest } from "@/lib/api";
import { requireSuperAdminApi } from "@/lib/superadmin/require-superadmin-api";
import { endPortalAccessSession } from "@/lib/superadmin/portal-access-session.service";

const bodySchema = z.object({
  sessionId: z.string().optional(),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }

    await endPortalAccessSession(auth.actor, parsed.data.sessionId, "ended");
    return ok({ ended: true });
  });
}
