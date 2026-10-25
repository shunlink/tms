import type { NextResponse } from "next/server";
import type { AuthContext } from "./auth-context";
import { forbidden } from "./api";
import { canClientPerformPortalMutations } from "./portal-access";
import { getOnboardingStatus } from "./services/onboarding.service";

const VIEW_ONLY_MESSAGE =
  "Your account is pending approval. You have view-only access until an administrator approves your account.";

/** Block CLIENT POST/PUT/PATCH/DELETE when onboarding is submitted but not approved. */
export async function denyUnapprovedClientMutation(
  auth: AuthContext | null
): Promise<NextResponse | null> {
  const user = auth?.user;
  if (!user || user.role !== "CLIENT" || !user.clientId) return null;

  const status = await getOnboardingStatus("CLIENT", user.clientId);
  if (canClientPerformPortalMutations(status)) return null;

  return forbidden(VIEW_ONLY_MESSAGE);
}
