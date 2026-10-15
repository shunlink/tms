import { prisma } from "../prisma";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";
import { portalHomeForRole } from "../portal-access";
import { getOnboardingStatus } from "../queries";
import { isInternalRole } from "../teams";
import { PORTAL_ACCESS_SESSION_TTL_MS } from "./portal-access-config";
import { verifyMasterOtpForActor } from "./master-otp.service";
import { parsePortalAccessIdentifier } from "./portal-access-marker";
import { PORTAL_ACCESS_VERIFY_DENIED } from "./portal-access-config";

export type PortalAccessJwtPayload = {
  sessionId: string;
  targetUserId: string;
  targetEmail: string | null;
  targetName: string | null;
  targetRole: string;
  targetClientId: string | null;
  targetVendorId: string | null;
  targetDriverId: string | null;
  expiresAt: number;
};

export type PortalAccessTargetPreview = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  teamCode: string | null;
  teamName: string | null;
  portalLabel: string;
  portalHome: string;
};

function portalLabelForRole(role: string, teamCode: string | null): string {
  if (role === "CLIENT") return "Client portal";
  if (role === "VENDOR") return "Vendor portal";
  if (role === "DRIVER") return "Driver app";
  if (isInternalRole(role)) {
    const team = teamCode ?? role;
    const labels: Record<string, string> = {
      FINANCE: "Finance (internal)",
      OPERATIONS: "Operations (internal)",
      SALES: "Sales (internal)",
      VENDOR_TEAM: "Vendor team (internal)",
      ADMIN: "Admin (internal)",
    };
    return labels[team] ?? `Internal (${role})`;
  }
  return role;
}

export function isEligiblePortalAccessTarget(user: {
  role: string;
  isActive: boolean;
  email: string | null;
}): boolean {
  if (!user.isActive || !user.email) return false;
  if (user.role === "SUPER_ADMIN") return false;
  return true;
}

async function resolveTargetByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      clientId: true,
      vendorId: true,
      driverId: true,
      team: { select: { code: true, name: true } },
    },
  });
}

export async function previewPortalAccessTarget(
  actorUserId: string,
  identifierRaw: string,
  masterOtp: string
): Promise<{ ok: true; target: PortalAccessTargetPreview } | { ok: false; error: string }> {
  const parsed = parsePortalAccessIdentifier(identifierRaw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const otpOk = await verifyMasterOtpForActor(actorUserId, masterOtp);
  const target = await resolveTargetByEmail(parsed.email);

  if (!otpOk || !target || !isEligiblePortalAccessTarget(target)) {
    await logAudit({
      user: { id: actorUserId },
      action: "PORTAL_ACCESS_DENIED",
      entity: "User",
      entityId: target?.id ?? null,
      meta: { reason: "verify_failed_or_ineligible", email: parsed.email },
    });
    return { ok: false, error: PORTAL_ACCESS_VERIFY_DENIED };
  }

  let onboardingStatus: string | undefined;
  if (target.role === "CLIENT" && target.clientId) {
    const ob = await getOnboardingStatus("CLIENT", target.clientId);
    onboardingStatus = ob?.onboardingStatus;
  } else if (target.role === "VENDOR" && target.vendorId) {
    const ob = await getOnboardingStatus("VENDOR", target.vendorId);
    onboardingStatus = ob?.onboardingStatus;
  }

  const portalHome = portalHomeForRole(target.role, onboardingStatus);

  return {
    ok: true,
    target: {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      teamCode: target.team?.code ?? null,
      teamName: target.team?.name ?? null,
      portalLabel: portalLabelForRole(target.role, target.team?.code ?? null),
      portalHome,
    },
  };
}

export async function startPortalAccessSession(
  actor: SessionUser & { id: string },
  identifierRaw: string,
  masterOtp: string
): Promise<
  | { ok: true; jwtPayload: PortalAccessJwtPayload; portalHome: string }
  | { ok: false; error: string }
> {
  const preview = await previewPortalAccessTarget(actor.id, identifierRaw, masterOtp);
  if (!preview.ok) return preview;

  const expiresAt = new Date(Date.now() + PORTAL_ACCESS_SESSION_TTL_MS);

  const session = await prisma.portalAccessSession.create({
    data: {
      actorUserId: actor.id,
      targetUserId: preview.target.id,
      expiresAt,
    },
  });

  await logAudit({
    user: actor,
    action: "PORTAL_ACCESS_STARTED",
    entity: "PortalAccessSession",
    entityId: session.id,
    meta: {
      actorId: actor.id,
      targetUserId: preview.target.id,
      targetEmail: preview.target.email,
      targetRole: preview.target.role,
    },
  });

  const jwtPayload: PortalAccessJwtPayload = {
    sessionId: session.id,
    targetUserId: preview.target.id,
    targetEmail: preview.target.email,
    targetName: preview.target.name,
    targetRole: preview.target.role,
    targetClientId: null,
    targetVendorId: null,
    targetDriverId: null,
    expiresAt: expiresAt.getTime(),
  };

  const fullTarget = await prisma.user.findUnique({
    where: { id: preview.target.id },
    select: { clientId: true, vendorId: true, driverId: true },
  });
  jwtPayload.targetClientId = fullTarget?.clientId ?? null;
  jwtPayload.targetVendorId = fullTarget?.vendorId ?? null;
  jwtPayload.targetDriverId = fullTarget?.driverId ?? null;

  return { ok: true, jwtPayload, portalHome: preview.target.portalHome };
}

export async function validatePortalAccessSession(
  actorUserId: string,
  jwtPayload: PortalAccessJwtPayload | null | undefined
): Promise<PortalAccessJwtPayload | null> {
  if (!jwtPayload?.sessionId) return null;
  if (jwtPayload.expiresAt <= Date.now()) return null;

  const row = await prisma.portalAccessSession.findFirst({
    where: {
      id: jwtPayload.sessionId,
      actorUserId,
      endedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row) return null;

  await prisma.portalAccessSession.update({
    where: { id: row.id },
    data: { lastActivityAt: new Date() },
  });

  return jwtPayload;
}

export async function endPortalAccessSession(
  actor: SessionUser & { id: string },
  sessionId: string | null | undefined,
  reason: "ended" | "revoked" = "ended"
) {
  if (!sessionId) return;
  const row = await prisma.portalAccessSession.findFirst({
    where: { id: sessionId, actorUserId: actor.id, endedAt: null },
  });
  if (!row) return;

  const now = new Date();
  await prisma.portalAccessSession.update({
    where: { id: row.id },
    data: {
      endedAt: now,
      revokedAt: reason === "revoked" ? now : undefined,
      revokedByUserId: reason === "revoked" ? actor.id : undefined,
    },
  });

  await logAudit({
    user: actor,
    action: reason === "revoked" ? "PORTAL_ACCESS_REVOKED" : "PORTAL_ACCESS_ENDED",
    entity: "PortalAccessSession",
    entityId: row.id,
    meta: { actorId: actor.id, targetUserId: row.targetUserId },
  });
}

export async function revokePortalAccessSessionById(
  revoker: SessionUser & { id: string },
  sessionId: string
) {
  const row = await prisma.portalAccessSession.findFirst({
    where: { id: sessionId, endedAt: null, revokedAt: null },
  });
  if (!row) return { ok: false as const, error: "Session not found or already ended" };

  const now = new Date();
  await prisma.portalAccessSession.update({
    where: { id: row.id },
    data: {
      endedAt: now,
      revokedAt: now,
      revokedByUserId: revoker.id,
    },
  });

  await logAudit({
    user: revoker,
    action: "PORTAL_ACCESS_REVOKED",
    entity: "PortalAccessSession",
    entityId: row.id,
    meta: {
      actorId: row.actorUserId,
      targetUserId: row.targetUserId,
      revokedBy: revoker.id,
    },
  });

  return { ok: true as const };
}
