import type { AuthContext } from "@/lib/auth-context";
import type { NextResponse } from "next/server";

/** Legacy hook for API routes; Super Admin may use onboarding requests. */
export function denySuperAdminOnboardingOps(_auth: AuthContext | null): NextResponse | null {
  return null;
}
