import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashOtp } from "../otp-hash";
import type { AuthContext } from "../auth-context";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  masterOtpConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  portalAccessSession: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: typeof prismaMock) => Promise<void>) => fn(prismaMock)),
}));

vi.mock("../prisma", () => ({ prisma: prismaMock }));
vi.mock("../audit", () => ({ logAudit: vi.fn() }));
vi.mock("../ratelimit", () => ({
  rateLimit: () => ({ ok: true, remaining: 10, retryAfter: 0 }),
}));
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async () => true) },
}));

import {
  parsePortalAccessIdentifier,
  PORTAL_ACCESS_EMAIL_MARKER,
} from "./portal-access-marker";
import {
  isEligiblePortalAccessTarget,
  previewPortalAccessTarget,
  startPortalAccessSession,
  endPortalAccessSession,
  validatePortalAccessSession,
} from "./portal-access-session.service";
import {
  generateMasterOtpPlaintext,
  regenerateMasterOtp,
  verifyMasterOtpForActor,
  clearMasterOtpFailureState,
} from "./master-otp.service";
import { impersonationBlocksPermission } from "./sensitive-actions";

describe("portal access marker", () => {
  it("parses <= email prefix exactly", () => {
    expect(parsePortalAccessIdentifier("<=employee@shunlink.in")).toEqual({
      ok: true,
      email: "employee@shunlink.in",
    });
    expect(parsePortalAccessIdentifier("=<employee@shunlink.in").ok).toBe(false);
    expect(parsePortalAccessIdentifier("< employee@shunlink.in").ok).toBe(false);
    expect(parsePortalAccessIdentifier("employee@shunlink.in").ok).toBe(false);
  });

  it("exports consistent marker constant", () => {
    expect(PORTAL_ACCESS_EMAIL_MARKER).toBe("<=");
  });
});

describe("portal access eligibility", () => {
  it("rejects inactive, super admin, and missing email", () => {
    expect(isEligiblePortalAccessTarget({ role: "FINANCE", isActive: true, email: "a@b.c" })).toBe(
      true
    );
    expect(isEligiblePortalAccessTarget({ role: "SUPER_ADMIN", isActive: true, email: "a@b.c" })).toBe(
      false
    );
    expect(isEligiblePortalAccessTarget({ role: "CLIENT", isActive: false, email: "a@b.c" })).toBe(
      false
    );
    expect(isEligiblePortalAccessTarget({ role: "CLIENT", isActive: true, email: null })).toBe(
      false
    );
  });
});

describe("master otp lifecycle", () => {
  const actorId = "super-1";

  beforeEach(() => {
    vi.clearAllMocks();
    clearMasterOtpFailureState(actorId);
  });

  it("generates high-entropy codes", () => {
    const a = generateMasterOtpPlaintext();
    const b = generateMasterOtpPlaintext();
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });

  it("rejects wrong otp and accepts after regeneration", async () => {
    const code = "test-code-abc";
    prismaMock.masterOtpConfig.findUnique.mockResolvedValue({ otpHash: hashOtp(code) });

    expect(await verifyMasterOtpForActor(actorId, "wrong")).toBe(false);
    expect(await verifyMasterOtpForActor(actorId, code)).toBe(true);
  });

  it("invalidates previous otp after regeneration", async () => {
    const oldCode = "old-secret";
    const newCode = "new-secret";
    prismaMock.masterOtpConfig.upsert.mockImplementation(async (args: { update: { otpHash: string } }) => {
      prismaMock.masterOtpConfig.findUnique.mockResolvedValue({ otpHash: args.update.otpHash });
      return {};
    });
    prismaMock.masterOtpConfig.findUnique.mockResolvedValue({ otpHash: hashOtp(oldCode) });
    expect(await verifyMasterOtpForActor(actorId, oldCode)).toBe(true);

    await regenerateMasterOtp(
      { id: actorId, role: "SUPER_ADMIN", email: "super@shunlink.in" },
      "password"
    );

    expect(await verifyMasterOtpForActor(actorId, oldCode)).toBe(false);
    expect(await verifyMasterOtpForActor(actorId, newCode)).toBe(true);
  });
});

describe("portal access sessions", () => {
  const actor = { id: "super-1", role: "SUPER_ADMIN", email: "super@shunlink.in" };

  beforeEach(() => {
    vi.clearAllMocks();
    clearMasterOtpFailureState(actor.id);
  });

  it("denies unknown employee with generic flow", async () => {
    prismaMock.masterOtpConfig.findUnique.mockResolvedValue({ otpHash: hashOtp("otp") });
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await previewPortalAccessTarget(actor.id, "<=missing@shunlink.in", "otp");
    expect(result.ok).toBe(false);
  });

  it("creates session payload and validates active session", async () => {
    const otp = "session-otp";
    prismaMock.masterOtpConfig.findUnique.mockResolvedValue({ otpHash: hashOtp(otp) });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: "emp-1",
        email: "finance@shunlink.in",
        name: "Finance User",
        role: "FINANCE",
        isActive: true,
        clientId: null,
        vendorId: null,
        driverId: null,
        team: { code: "FINANCE", name: "Finance" },
        client: null,
        vendor: null,
      })
      .mockResolvedValueOnce({
        clientId: null,
        vendorId: null,
        driverId: null,
      });

    prismaMock.portalAccessSession.create.mockResolvedValue({ id: "sess-1" });

    const started = await startPortalAccessSession(actor, "<=finance@shunlink.in", otp);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    prismaMock.portalAccessSession.findFirst.mockResolvedValue({ id: "sess-1" });
    prismaMock.portalAccessSession.update.mockResolvedValue({});

    const valid = await validatePortalAccessSession(actor.id, started.jwtPayload);
    expect(valid?.sessionId).toBe("sess-1");

    prismaMock.portalAccessSession.findFirst.mockResolvedValue({
      id: "sess-1",
      targetUserId: "emp-1",
    });
    await endPortalAccessSession(actor, "sess-1");
    expect(prismaMock.portalAccessSession.update).toHaveBeenCalled();
  });
});

describe("authorization during impersonation", () => {
  it("blocks sensitive permissions and superadmin bypass", () => {
    const auth: AuthContext = {
      actor: { id: "super", role: "SUPER_ADMIN", email: "s@x.com" },
      user: { id: "emp", role: "FINANCE", email: "e@x.com" },
      impersonation: {
        sessionId: "sess",
        targetUserId: "emp",
        targetEmail: "e@x.com",
        targetRole: "FINANCE",
      },
    };
    expect(impersonationBlocksPermission(auth, "payment.process")).toBe(true);
    expect(impersonationBlocksPermission(auth, "indent.view")).toBe(false);
  });
});
