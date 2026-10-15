import { handleApi, ok, badRequest } from "@/lib/api";
import { requireSuperAdminApi } from "@/lib/superadmin/require-superadmin-api";
import { revokePortalAccessSessionById } from "@/lib/superadmin/portal-access-session.service";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  return handleApi(async () => {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;

    const result = await revokePortalAccessSessionById(auth.actor, params.id);
    if (!result.ok) return badRequest(result.error);
    return ok({ revoked: true });
  });
}
