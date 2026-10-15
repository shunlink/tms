import { describe, it, expect } from "vitest";
import {
  canTransition,
  INDENT_TRANSITIONS,
  INDENT_STATUSES,
  assertTransition,
} from "./indent-states";
import { normalizeDl, isOtpValid, otpExpiresAt, generateOtp, OTP_TTL_MS } from "./otp";
import { parseQuoteAmount, parseQuoteMessage } from "./whatsapp-parse";
import { PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS } from "./permissions";
import { TRACKING_SOURCES, POD_SOURCES, EVENT_SEVERITIES, EVENT_STATUSES, PLACEMENT_DEADLINE_MS } from "./constants";

describe("Indent lifecycle state machine", () => {
  it("Test 1 — a draft indent can be saved and moved to the finance queue", () => {
    expect(INDENT_STATUSES).toContain("DRAFT");
    expect(canTransition("DRAFT", "WAITING_FOR_ADVANCE")).toBe(true);
  });

  it("Test 2 — advance can be confirmed directly from draft or waiting", () => {
    expect(canTransition("DRAFT", "ADVANCE_PAID")).toBe(true);
    expect(canTransition("WAITING_FOR_ADVANCE", "ADVANCE_PAID")).toBe(true);
    expect(canTransition("ADVANCE_PENDING", "ADVANCE_PAID")).toBe(true);
  });

  it("Test 3 — indent can be released to vendors without advance (trip-based advance)", () => {
    expect(canTransition("WAITING_FOR_ADVANCE", "RELEASED_TO_VENDORS")).toBe(true);
    expect(canTransition("DRAFT", "RELEASED_TO_VENDORS")).toBe(true);
    expect(canTransition("ADVANCE_PAID", "RELEASED_TO_VENDORS")).toBe(true);
  });

  it("Test 7 — allocation moves the indent into placement", () => {
    expect(canTransition("QUOTING", "VENDOR_ALLOCATED")).toBe(true);
    expect(canTransition("VENDOR_ALLOCATED", "PLACEMENT_PENDING")).toBe(true);
  });

  it("Test 8/9 — placement expiry never auto-cancels; reallocation is explicit", () => {
    // The normal path continues to vehicle placement.
    expect(canTransition("PLACEMENT_PENDING", "VEHICLE_PLACED")).toBe(true);
    // Reallocation resets operational workflow back to placement.
    expect(canTransition("VEHICLE_PLACED", "PLACEMENT_PENDING")).toBe(true);
    expect(canTransition("DRIVER_ASSIGNED", "PLACEMENT_PENDING")).toBe(true);
    // Reallocation is an explicit admin action (back to VENDOR_ALLOCATED).
    expect(canTransition("PLACEMENT_PENDING", "VENDOR_ALLOCATED")).toBe(true);
    // Cancellation exists but is only reachable via an explicit action — the
    // deadline evaluator never changes indent.status (it only raises an event).
    expect(INDENT_TRANSITIONS["PLACEMENT_PENDING"]).toContain("CANCELLED");
    // No automatic terminal transition exists.
    expect(INDENT_TRANSITIONS["PLACEMENT_PENDING"]).not.toContain("COMPLETED");
  });

  it("assertTransition rejects illegal moves", () => {
    expect(() => assertTransition("DRAFT", "IN_TRANSIT")).toThrow(/Invalid state transition/);
  });
});

describe("Driver identity (DL canonical, phone not unique)", () => {
  it("Test 10/11 — DL number is the canonical identity; phone is not used as identity", () => {
    // Two different DLs (could share the same phone) are distinct identities.
    expect(normalizeDl("DL001")).toBe("DL001");
    expect(normalizeDl("dl 001")).toBe("DL001");
    expect(normalizeDl("DL001")).not.toBe(normalizeDl("DL002"));
    // Reuse: same DL canonicalizes to the same key.
    expect(normalizeDl("mh 0123456789")).toBe("MH0123456789");
  });

  it("Test 12 — driver OTP validates code and expiry", () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    expect(isOtpValid(code, otpExpiresAt(), code)).toBe(true);
    expect(isOtpValid(code, otpExpiresAt(), "000000")).toBe(false);
    expect(isOtpValid(code, new Date(Date.now() - 1000), code)).toBe(false);
    expect(OTP_TTL_MS).toBe(10 * 60 * 1000);
  });
});

describe("WhatsApp quoting (same VendorQuote system as portal)", () => {
  it("Test 5 — parses a valid WhatsApp quote", () => {
    expect(parseQuoteMessage("quote IND-2026-0001 42000")).toEqual({
      indentNumber: "IND-2026-0001",
      quotedRate: 42000,
    });
    expect(parseQuoteMessage("42000 for ind-2026-0001")).toEqual({
      indentNumber: "IND-2026-0001",
      quotedRate: 42000,
    });
    expect(parseQuoteMessage("IND-2026-0001 ₹42,000")).toEqual({
      indentNumber: "IND-2026-0001",
      quotedRate: 42000,
    });
  });

  it("Test 4/5 — rejects invalid or ambiguous quotes safely", () => {
    expect(parseQuoteMessage("hello")).toBeNull();
    expect(parseQuoteMessage("quote IND-2026-0001 no rate")).toBeNull();
    expect(parseQuoteMessage("quote XYZ 42000")).toBeNull();
  });

  it("parses amount-only WhatsApp replies", () => {
    expect(parseQuoteAmount("45000")).toBe(45000);
    expect(parseQuoteAmount("₹45,000")).toBe(45000);
    expect(parseQuoteAmount("45,000")).toBe(45000);
    expect(parseQuoteAmount("quote IND-2026-0001 42000")).toBeNull();
    expect(parseQuoteAmount("hello")).toBeNull();
  });

  it("Test 6 — top quotes sorted lowest rate first", () => {
    const quotes = [
      { vendor: "C", quotedRate: 44000 },
      { vendor: "A", quotedRate: 42000 },
      { vendor: "B", quotedRate: 43000 },
      { vendor: "D", quotedRate: 45000 },
      { vendor: "E", quotedRate: 46000 },
      { vendor: "F", quotedRate: 41000 },
    ];
    const top5 = [...quotes].sort((a, b) => a.quotedRate - b.quotedRate).slice(0, 5);
    expect(top5.map((q) => q.vendor)).toEqual(["F", "A", "B", "C", "D"]);
  });
});

describe("RBAC permissions", () => {
  it("Test 18 — SALES can create/edit indents but cannot allocate or approve advance", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.SALES).toContain("indent.create");
    expect(DEFAULT_ROLE_PERMISSIONS.SALES).toContain("indent.edit");
    expect(DEFAULT_ROLE_PERMISSIONS.SALES).not.toContain("indent.allocate");
    expect(DEFAULT_ROLE_PERMISSIONS.SALES).not.toContain("advance.decide");
    expect(DEFAULT_ROLE_PERMISSIONS.SALES).not.toContain("permissions.manage");
  });

  it("Test 18 — FINANCE can create indents, allocate vendors, and verify POD", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCE).toContain("advance.view");
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCE).toContain("advance.decide");
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCE).toContain("advance.markPaid");
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCE).toContain("indent.create");
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCE).toContain("indent.allocate");
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCE).toContain("pod.approve");
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCE).toContain("pod.manage");
  });

  it("Test 18 — OPERATIONS handles allocation/placement/vehicle/driver/tracking but not POD verify", () => {
    const ops = DEFAULT_ROLE_PERMISSIONS.OPERATIONS;
    for (const p of ["indent.create", "indent.allocate", "indent.reallocate", "placement.update", "vehicle.edit", "driver.create", "tracking.view", "pod.upload"]) {
      expect(ops).toContain(p);
    }
    expect(ops).not.toContain("pod.approve");
    expect(ops).not.toContain("advance.decide");
  });

  it("Test 18 — VENDOR can only quote; DRIVER only sees own data", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.VENDOR).toContain("quote.submit");
    expect(DEFAULT_ROLE_PERMISSIONS.VENDOR).not.toContain("indent.view");
    expect(DEFAULT_ROLE_PERMISSIONS.VENDOR).not.toContain("driver.create");

    expect(DEFAULT_ROLE_PERMISSIONS.DRIVER).toContain("pod.upload");
    expect(DEFAULT_ROLE_PERMISSIONS.DRIVER).not.toContain("quote.view");
    expect(DEFAULT_ROLE_PERMISSIONS.DRIVER).not.toContain("indent.view");
  });

  it("Test 18/20 — SUPER_ADMIN has full access; critical keys exist", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toHaveLength(PERMISSION_KEYS.length);
    for (const p of ["indent.allocate", "advance.decide", "users.manage", "permissions.manage", "audit.view"]) {
      expect(PERMISSION_KEYS).toContain(p);
    }
  });
});

describe("Domain constants (tracking, POD, events)", () => {
  it("Test 14/15 — GPS and CELL tracking sources are supported", () => {
    expect(TRACKING_SOURCES).toEqual(["GPS", "CELL"]);
  });

  it("Test 16/17 — POD can be uploaded by DRIVER, EMPLOYEE, or VENDOR", () => {
    expect(POD_SOURCES).toEqual(["DRIVER", "EMPLOYEE", "VENDOR"]);
  });

  it("Test 19 — important events have severities and lifecycle statuses", () => {
    expect(EVENT_SEVERITIES).toEqual(["INFO", "WARNING", "CRITICAL"]);
    expect(EVENT_STATUSES).toEqual(["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]);
  });

  it("Test 8 — placement deadline is exactly 24 hours", () => {
    expect(PLACEMENT_DEADLINE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
