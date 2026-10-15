import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  normalizePhoneOrOriginal,
  resolveWhatsAppRecipient,
  formatPhoneE164,
  phonesMatch,
} from "./phone";

describe("normalizePhone", () => {
  it("adds the country code to a bare 10-digit national number", () => {
    expect(normalizePhone("9820012345")).toBe("919820012345");
    expect(normalizePhone("9021077286")).toBe("919021077286");
  });

  it("strips formatting characters and the leading +", () => {
    expect(normalizePhone("+91 90210 77286")).toBe("919021077286");
    expect(normalizePhone("+91-90210-77286")).toBe("919021077286");
    expect(normalizePhone("(982) 001-2345")).toBe("919820012345");
  });

  it("drops the national trunk prefix 0", () => {
    expect(normalizePhone("09820012345")).toBe("919820012345");
    expect(normalizePhone("0 98200 12345")).toBe("919820012345");
  });

  it("drops the international 00 prefix", () => {
    expect(normalizePhone("0091 9820012345")).toBe("919820012345");
    expect(normalizePhone("+91 9820012345")).toBe("919820012345");
  });

  it("leaves an already-canonical number untouched", () => {
    expect(normalizePhone("919820012345")).toBe("919820012345");
  });

  it("keeps non-Indian international numbers as-is", () => {
    expect(normalizePhone("+1 555 646 1110")).toBe("15556461110");
  });

  it("returns null for empty or unusable input", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("982001234")).toBeNull(); // 9 digits
    expect(normalizePhone("1234567890123456789")).toBeNull(); // > E.164 max
  });
});

describe("normalizePhoneOrOriginal", () => {
  it("normalizes when possible", () => {
    expect(normalizePhoneOrOriginal("9820012345")).toBe("919820012345");
  });

  it("keeps the typed value when it is not a phone number", () => {
    expect(normalizePhoneOrOriginal("Call the office")).toBe("Call the office");
  });

  it("returns null for empty input", () => {
    expect(normalizePhoneOrOriginal("")).toBeNull();
    expect(normalizePhoneOrOriginal(null)).toBeNull();
  });
});

describe("resolveWhatsAppRecipient", () => {
  it("prefers the WhatsApp number over the primary phone", () => {
    expect(resolveWhatsAppRecipient({ whatsapp: "9820012345", phone: "9021077286" })).toBe(
      "919820012345"
    );
  });

  it("falls back to the primary phone", () => {
    expect(resolveWhatsAppRecipient({ whatsapp: null, phone: "+91 9021077286" })).toBe(
      "919021077286"
    );
  });

  it("returns null when neither number is usable", () => {
    expect(resolveWhatsAppRecipient({ whatsapp: null, phone: null })).toBeNull();
    expect(resolveWhatsAppRecipient({ whatsapp: "", phone: "n/a" })).toBeNull();
  });
});

describe("formatPhoneE164", () => {
  it("restores the leading + for display", () => {
    expect(formatPhoneE164("919820012345")).toBe("+919820012345");
    expect(formatPhoneE164(null)).toBeNull();
  });
});

describe("phonesMatch", () => {
  it("ignores formatting differences", () => {
    expect(phonesMatch("+91 90210 77286", "9021077286")).toBe(true);
    expect(phonesMatch("919820012345", "9820012345")).toBe(true);
  });

  it("rejects different numbers", () => {
    expect(phonesMatch("9820012345", "9820012346")).toBe(false);
  });

  it("falls back to string comparison for non-phone identifiers", () => {
    expect(phonesMatch("driver-01", "driver-01")).toBe(true);
    expect(phonesMatch("driver-01", "driver-02")).toBe(false);
    expect(phonesMatch(null, "")).toBe(false);
  });
});
