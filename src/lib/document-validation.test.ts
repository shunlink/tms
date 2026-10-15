import { describe, it, expect } from "vitest";
import { validateUploadedFile } from "./document-validation";

describe("validateUploadedFile", () => {
  it("rejects empty files", () => {
    expect(validateUploadedFile({ name: "a.pdf", size: 0 }).ok).toBe(false);
  });

  it("rejects unsupported extensions", () => {
    expect(validateUploadedFile({ name: "virus.exe", size: 100 }).ok).toBe(false);
  });

  it("rejects oversized files", () => {
    expect(validateUploadedFile({ name: "big.pdf", size: 11 * 1024 * 1024 }).ok).toBe(false);
  });

  it("accepts valid PDF uploads", () => {
    expect(
      validateUploadedFile({ name: "gst.pdf", size: 1024, type: "application/pdf" }).ok
    ).toBe(true);
  });
});
