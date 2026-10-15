import type { SessionUser } from "../auth";
import type { ImpersonationContext } from "../auth-portal-access";
import { logAudit, type LogAuditOptions } from "../audit";

/** Write audit entries under the Superadmin actor with target employee context. */
export async function logAuditAsPortalActor(
  actor: SessionUser | null | undefined,
  impersonation: ImpersonationContext | null,
  opts: Omit<LogAuditOptions, "user" | "meta"> & { meta?: Record<string, unknown> }
) {
  const meta = {
    ...(opts.meta ?? {}),
    ...(impersonation
      ? {
          portalAccessSessionId: impersonation.sessionId,
          portalAccessTargetUserId: impersonation.targetUserId,
          portalAccessTargetEmail: impersonation.targetEmail,
        }
      : {}),
  };
  await logAudit({
    ...opts,
    user: actor ?? undefined,
    meta,
  });
}
