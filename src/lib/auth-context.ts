import type { SessionUser } from "./auth";
import { resolvePortalAccessFromSession, type ImpersonationContext } from "./auth-portal-access";

export type AuthContext = {
  /** Effective identity (target employee while impersonating). */
  user: SessionUser & { id: string };
  /** Real signed-in user (Superadmin during portal access). */
  actor: SessionUser & { id: string };
  impersonation: ImpersonationContext | null;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const ctx = await resolvePortalAccessFromSession();
  if (!ctx) return null;

  return {
    user: ctx.effective,
    actor: ctx.actor,
    impersonation: ctx.impersonation,
  };
}
