/** Relative paths vendors may return to after login (deep links from WhatsApp, etc.). */
const ALLOWED_NEXT_PREFIX = "/portal/vendor";

export function getPublicAppBaseUrl(): string {
  const base = (process.env.PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
  if (!base) {
    throw new Error("PUBLIC_BASE_URL or NEXTAUTH_URL must be set for vendor quote links");
  }
  return base;
}

/** Blocks open redirects; only in-app vendor portal paths. */
export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let path = raw.trim();
  if (!path) return null;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const u = new URL(path);
      const baseRaw = (process.env.PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? "").replace(
        /\/+$/,
        ""
      );
      if (!baseRaw) return null;
      const allowed = new URL(baseRaw);
      if (u.origin !== allowed.origin) return null;
      path = u.pathname + u.search;
    } catch {
      return null;
    }
  }

  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (!path.startsWith(ALLOWED_NEXT_PREFIX)) return null;
  return path;
}

export function buildVendorQuotePortalPath(indentId: string): string {
  const id = indentId.trim();
  return `/portal/vendor/indents?indentId=${encodeURIComponent(id)}`;
}

export function buildVendorQuoteAccessPath(accessToken: string): string {
  const token = accessToken.trim();
  return `/quote/${token}`;
}

export function buildVendorQuoteAccessUrl(accessToken: string): string {
  const base = getPublicAppBaseUrl();
  return new URL(buildVendorQuoteAccessPath(accessToken), base).toString();
}

export function buildVendorOpenIndentsLoginUrl(): string {
  const base = getPublicAppBaseUrl();
  const login = new URL("/login", base);
  login.searchParams.set("portal", "transporter");
  login.searchParams.set("next", "/portal/vendor/indents");
  return login.toString();
}

export function buildVendorQuoteLoginUrl(indentId: string): string {
  const base = getPublicAppBaseUrl();
  const next = buildVendorQuotePortalPath(indentId);
  const login = new URL("/login", base);
  login.searchParams.set("portal", "transporter");
  login.searchParams.set("next", next);
  return login.toString();
}

/**
 * Meta URL-button templates often use a fixed host in the template and one {{1}} suffix.
 * Set WHATSAPP_BID_TEMPLATE_URL_MODE=full to pass the entire https URL as {{1}}.
 */
export function buildVendorQuoteTemplateButtonParamFromAccessUrl(quotePageUrl: string): string {
  if (process.env.WHATSAPP_BID_TEMPLATE_URL_MODE?.trim().toLowerCase() === "full") {
    return quotePageUrl;
  }
  const u = new URL(quotePageUrl);
  return `${u.pathname}${u.search}`;
}

/** @deprecated Use per-vendor access URLs from ensureVendorQuoteAccess instead. */
export function buildVendorQuoteTemplateButtonParam(indentId: string): string {
  const loginUrl = buildVendorQuoteLoginUrl(indentId);
  return buildVendorQuoteTemplateButtonParamFromAccessUrl(loginUrl);
}

export function resolvePostLoginPath(
  nextParam: string | null | undefined,
  callbackUrlParam: string | null | undefined,
  fallbackPath: string
): string {
  return sanitizeNextPath(nextParam) ?? sanitizeNextPath(callbackUrlParam) ?? fallbackPath;
}
