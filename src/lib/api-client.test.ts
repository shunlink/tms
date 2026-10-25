import { describe, expect, it } from "vitest";
import { DEFAULT_FORBIDDEN_MESSAGE } from "./api-errors";
import { resolveApiError } from "./api-client";

function res(status: number) {
  return { status, ok: status >= 200 && status < 300 };
}

describe("resolveApiError", () => {
  it("maps generic Forbidden to friendly copy", () => {
    const err = resolveApiError(res(403), { error: "Forbidden" });
    expect(err.message).toBe(DEFAULT_FORBIDDEN_MESSAGE);
    expect(err.code).toBeUndefined();
  });

  it("maps code FORBIDDEN from API envelope", () => {
    const err = resolveApiError(res(403), {
      success: false,
      error: DEFAULT_FORBIDDEN_MESSAGE,
      code: "FORBIDDEN",
    });
    expect(err.message).toBe(DEFAULT_FORBIDDEN_MESSAGE);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("preserves custom forbidden messages", () => {
    const err = resolveApiError(res(403), {
      error: "Profile is read-only. Contact your administrator to make changes.",
      code: "FORBIDDEN",
    });
    expect(err.message).toContain("read-only");
  });

  it("falls back by HTTP status when body is empty", () => {
    expect(resolveApiError(res(401), null).message).toMatch(/sign in/i);
    expect(resolveApiError(res(404), null).message).toMatch(/could not be found/i);
  });

  it("handles OTP codes", () => {
    const err = resolveApiError(res(400), { code: "OTP_EXPIRED" });
    expect(err.message).toMatch(/expired/i);
  });
});
