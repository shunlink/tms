import { requireAuth, ok, unauthorized, serverError } from "@/lib/api";
import { getGrantedPermissions } from "@/lib/services/permission.service";

export async function GET() {
  const auth = await requireAuth();
  if (!auth?.user.id) return unauthorized();

  try {
    const permissions = await getGrantedPermissions(auth.user.id);
    return ok({ permissions: Array.from(permissions) });
  } catch (e) {
    return serverError(e);
  }
}
