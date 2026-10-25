import { getSessionUser } from "@/lib/auth";
import { resolveAuthenticatedHomePath } from "@/lib/auth-redirect";

export async function GET() {
  const user = await getSessionUser();
  if (!user?.id) {
    return Response.json({ path: "/welcome" });
  }
  const path = await resolveAuthenticatedHomePath(user);
  return Response.json({ path });
}
