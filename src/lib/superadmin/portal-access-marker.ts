/** Exact Superadmin portal-access employee identifier prefix. */
export const PORTAL_ACCESS_EMAIL_MARKER = "<=" as const;

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export type ParsedPortalAccessIdentifier =
  | { ok: true; email: string }
  | { ok: false; error: string };

/**
 * Parse `<=employee@example.com` — marker must be exact; email is normalized (trim, lowercase).
 */
export function parsePortalAccessIdentifier(raw: string): ParsedPortalAccessIdentifier {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(PORTAL_ACCESS_EMAIL_MARKER)) {
    return {
      ok: false,
      error: `Employee identifier must start with ${PORTAL_ACCESS_EMAIL_MARKER}`,
    };
  }
  const emailPart = trimmed.slice(PORTAL_ACCESS_EMAIL_MARKER.length).trim();
  if (!emailPart) {
    return { ok: false, error: "Enter the employee email after the <= marker" };
  }
  if (trimmed.slice(PORTAL_ACCESS_EMAIL_MARKER.length).startsWith(" ")) {
    // allow single trim after marker only via emailPart trim — reject internal spaces before email
  }
  const email = emailPart.toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid employee email after the <= marker" };
  }
  return { ok: true, email };
}
