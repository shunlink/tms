import { describe, expect, it } from "vitest";
import {
  buildVendorQuoteAccessPath,
  buildVendorQuoteAccessUrl,
  buildVendorQuoteLoginUrl,
  buildVendorQuotePortalPath,
  sanitizeNextPath,
} from "./vendor-quote-portal-url";

describe("sanitizeNextPath", () => {
  it("allows vendor portal paths", () => {
    expect(sanitizeNextPath("/portal/vendor/indents?indentId=abc")).toBe(
      "/portal/vendor/indents?indentId=abc"
    );
  });

  it("rejects external and non-vendor paths", () => {
    process.env.PUBLIC_BASE_URL = "https://tms.example.com";
    expect(sanitizeNextPath("https://evil.com/portal/vendor")).toBeNull();
    expect(sanitizeNextPath("/admin")).toBeNull();
    expect(sanitizeNextPath("//evil.com")).toBeNull();
  });

  it("extracts path from same-origin callback URLs", () => {
    process.env.PUBLIC_BASE_URL = "https://tms.example.com";
    expect(sanitizeNextPath("https://tms.example.com/portal/vendor/trips")).toBe(
      "/portal/vendor/trips"
    );
  });
});

describe("buildVendorQuoteAccessUrl", () => {
  it("builds public quote page URL", () => {
    process.env.PUBLIC_BASE_URL = "https://tms.example.com";
    expect(buildVendorQuoteAccessPath("tok_abc")).toBe("/quote/tok_abc");
    const url = new URL(buildVendorQuoteAccessUrl("tok_abc"));
    expect(url.pathname).toBe("/quote/tok_abc");
  });
});

describe("buildVendorQuoteLoginUrl", () => {
  it("builds login URL with next deep link", () => {
    process.env.PUBLIC_BASE_URL = "https://tms.example.com";
    const url = new URL(buildVendorQuoteLoginUrl("ind_123"));
    expect(url.origin).toBe("https://tms.example.com");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("portal")).toBe("transporter");
    expect(url.searchParams.get("next")).toBe(buildVendorQuotePortalPath("ind_123"));
  });
});
