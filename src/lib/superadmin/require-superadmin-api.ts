import { NextResponse } from "next/server";
import { getActorSessionUser } from "../auth";
import type { SessionUser } from "../auth";

export async function requireSuperAdminApi(): Promise<
  { actor: SessionUser & { id: string } } | { response: NextResponse }
> {
  const actor = await getActorSessionUser();
  if (!actor?.id || actor.role !== "SUPER_ADMIN") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor: { ...actor, id: actor.id } };
}
