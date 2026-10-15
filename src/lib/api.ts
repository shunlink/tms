import { NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "./auth-context";
import { formatPrismaError, logQueryError } from "./prisma-errors";
import { hasPermission, type PermissionKey } from "./services/permission.service";
import { handleThrownError, type ApiErrorCode } from "./api-errors";
import { isInternalRole as checkInternalRole } from "./teams";
import { impersonationBlocksPermission } from "./superadmin/sensitive-actions";

export async function requireAuth() {
  return getAuthContext();
}

function superAdminBypass(auth: AuthContext): boolean {
  if (auth.impersonation) return false;
  return auth.actor.role === "SUPER_ADMIN";
}

/** Permission-based authorization guard. Returns a Response when denied, else null. */
export async function authorize(
  auth: AuthContext | null,
  permission?: PermissionKey
): Promise<NextResponse | null> {
  if (!auth) return unauthorized();
  if (!permission) return null;
  if (impersonationBlocksPermission(auth, permission)) {
    return forbidden("This action is not available during Superadmin portal access");
  }
  if (superAdminBypass(auth)) return null;
  if (!(await hasPermission(auth.user.id, permission))) return forbidden();
  return null;
}

/** Allow when the user has at least one of the given permissions. */
export async function authorizeAny(
  auth: AuthContext | null,
  permissions: PermissionKey[]
): Promise<NextResponse | null> {
  if (!auth) return unauthorized();
  if (superAdminBypass(auth)) return null;
  for (const p of permissions) {
    if (impersonationBlocksPermission(auth, p)) continue;
    if (await hasPermission(auth.user.id, p)) return null;
  }
  return forbidden();
}

export function isInternalRole(role?: string) {
  return checkInternalRole(role);
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function created(data: unknown) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(
  message: string,
  opts?: { code?: ApiErrorCode; fieldErrors?: Record<string, string>; retryAfter?: number }
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: opts?.code,
      fieldErrors: opts?.fieldErrors,
      retryAfter: opts?.retryAfter,
    },
    { status: 400 }
  );
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serviceUnavailable(message: string) {
  return NextResponse.json({ error: message }, { status: 503 });
}

export function serverError(e: unknown) {
  const mapped = handleThrownError(e);
  if (mapped) return mapped;

  console.error(e);
  const { status, message } = formatPrismaError(e);
  return NextResponse.json({ success: false, error: message }, { status });
}

/** Wrap an API handler with auth + consistent try/catch */
export async function handleApi<T>(
  handler: () => Promise<NextResponse<T> | Response>
): Promise<NextResponse | Response> {
  try {
    return await handler();
  } catch (e) {
    return serverError(e);
  }
}

/** GET helper: return fallback data (empty list / zero counts) instead of 500 on read failures. */
export async function safeOk<T>(label: string, fn: () => Promise<T>, fallback: T) {
  try {
    return ok(await fn());
  } catch (e) {
    logQueryError(`api:${label}`, e);
    return ok(fallback);
  }
}
