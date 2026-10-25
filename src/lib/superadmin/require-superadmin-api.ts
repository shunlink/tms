import { NextResponse } from "next/server";
import { getActorSessionUser } from "../auth";
import type { SessionUser } from "../auth";
import { forbiddenErrorBody } from "../api-errors";

export async function requireSuperAdminApi(): Promise<
  { actor: SessionUser & { id: string } } | { response: NextResponse }
> {
  const actor = await getActorSessionUser();
  if (!actor?.id || actor.role !== "SUPER_ADMIN") {
    return { response: NextResponse.json(forbiddenErrorBody(), { status: 403 }) };
  }
  return { actor: { ...actor, id: actor.id } };
}
