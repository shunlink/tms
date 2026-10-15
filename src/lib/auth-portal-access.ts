import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "./auth";
import { prisma } from "./prisma";
import {
  validatePortalAccessSession,
  type PortalAccessJwtPayload,
} from "./superadmin/portal-access-session.service";

export type ActorSessionUser = SessionUser & { id: string };

export type ImpersonationContext = {
  sessionId: string;
  targetUserId: string;
  targetEmail: string | null;
  targetRole: string;
};

async function loadUserSessionFields(userId: string): Promise<SessionUser | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clientId: true,
      vendorId: true,
      driverId: true,
      isActive: true,
    },
  });
  if (!row || !row.isActive) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    clientId: row.clientId,
    vendorId: row.vendorId,
    driverId: row.driverId,
  };
}

export async function getActorFromSession(): Promise<ActorSessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const actorFromSession = (session as { actor?: { id?: string } }).actor?.id;
  const actorId = actorFromSession ?? session.user.id;
  if (!actorId) return null;
  const actor = await loadUserSessionFields(actorId);
  if (!actor?.id) return null;
  return { ...actor, id: actor.id };
}

export async function resolvePortalAccessFromSession(): Promise<{
  actor: ActorSessionUser;
  effective: SessionUser & { id: string };
  impersonation: ImpersonationContext | null;
  jwtPortalAccess: PortalAccessJwtPayload | null;
} | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const jwtPortalAccess = (session as { portalAccessJwt?: PortalAccessJwtPayload | null })
    .portalAccessJwt;
  const actorId =
    (session as { actor?: { id?: string } }).actor?.id ?? session.user.id ?? null;
  if (!actorId) return null;

  const actor = await loadUserSessionFields(actorId);
  if (!actor?.id) return null;

  const validated = await validatePortalAccessSession(actor.id, jwtPortalAccess ?? null);
  if (!validated) {
    return {
      actor: { ...actor, id: actor.id },
      effective: { ...actor, id: actor.id },
      impersonation: null,
      jwtPortalAccess: null,
    };
  }

  const target = await loadUserSessionFields(validated.targetUserId);
  if (!target?.id) {
    return {
      actor: { ...actor, id: actor.id },
      effective: { ...actor, id: actor.id },
      impersonation: null,
      jwtPortalAccess: null,
    };
  }

  return {
    actor: { ...actor, id: actor.id },
    effective: {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      clientId: validated.targetClientId ?? target.clientId,
      vendorId: validated.targetVendorId ?? target.vendorId,
      driverId: validated.targetDriverId ?? target.driverId,
    },
    impersonation: {
      sessionId: validated.sessionId,
      targetUserId: target.id,
      targetEmail: target.email ?? null,
      targetRole: target.role ?? "",
    },
    jwtPortalAccess: validated,
  };
}
