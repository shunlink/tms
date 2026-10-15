import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

export type LogAuditOptions = {
  user?: SessionUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  tripId?: string | null;
  meta?: unknown;
  before?: unknown;
  after?: unknown;
  /** Override team snapshot when already known by caller */
  teamId?: string | null;
  teamCode?: string | null;
};

async function resolveActorTeam(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true, team: { select: { code: true } } },
  });
  return {
    teamId: row?.teamId ?? null,
    teamCode: row?.team?.code ?? null,
  };
}

function serialize(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

/** Append-only employee activity log. Never throws — failures are logged to console. */
export async function logAudit(opts: LogAuditOptions) {
  try {
    const sessionUser = opts.user as SessionUser | null | undefined;
    const impersonating =
      sessionUser?.portalAccessSessionId &&
      sessionUser.actorId &&
      sessionUser.actorId !== sessionUser.id;
    const actorId = impersonating ? sessionUser.actorId! : sessionUser?.id ?? null;
    const targetUserId = impersonating ? sessionUser?.id ?? null : null;

    let teamId = opts.teamId ?? null;
    let teamCode = opts.teamCode ?? null;

    if (actorId && teamId == null && teamCode == null) {
      const team = await resolveActorTeam(actorId);
      teamId = team.teamId;
      teamCode = team.teamCode;
    }

    const metaPayload =
      targetUserId != null
        ? {
            ...(opts.meta && typeof opts.meta === "object" ? opts.meta : {}),
            portalAccessSessionId: sessionUser?.portalAccessSessionId,
            portalAccessTargetUserId: targetUserId,
          }
        : opts.meta;

    const actorEmail =
      impersonating && actorId
        ? (
            await prisma.user.findUnique({
              where: { id: actorId },
              select: { email: true },
            })
          )?.email ?? sessionUser?.email ?? null
        : sessionUser?.email ?? null;

    await prisma.auditLog.create({
      data: {
        userId: actorId,
        userEmail: actorEmail,
        teamId,
        teamCode,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId ?? null,
        tripId: opts.tripId ?? null,
        meta: serialize(metaPayload),
        before: serialize(opts.before),
        after: serialize(opts.after),
      },
    });
  } catch (e) {
    console.error("Failed to write audit log", e);
  }
}
