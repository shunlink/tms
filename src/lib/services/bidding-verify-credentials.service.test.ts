import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  client: { findFirst: vi.fn() },
  vendor: { findFirst: vi.fn() },
}));

vi.mock("../prisma", () => ({ prisma: prismaMock }));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn() },
}));

import bcrypt from "bcryptjs";
import { verifyCredentialsForBidding } from "./bidding-verify-credentials.service";

describe("verifyCredentialsForBidding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when password does not match", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "A",
      password: "hash",
      role: "CLIENT",
      isActive: true,
      clientId: "c1",
      vendorId: null,
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const result = await verifyCredentialsForBidding({
      email: "a@b.com",
      password: "wrong",
    });
    expect(result).toBeNull();
  });

  it("returns client company payload when valid", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "A",
      password: "hash",
      role: "CLIENT",
      isActive: true,
      clientId: "c1",
      vendorId: null,
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    prismaMock.client.findFirst.mockResolvedValue({
      id: "c1",
      name: "Acme",
      legalName: "Acme Logistics Pvt Ltd",
    });

    const result = await verifyCredentialsForBidding({
      email: "a@b.com",
      password: "secret",
    });

    expect(result).toEqual({
      success: true,
      user: {
        tmsUserId: "u1",
        email: "a@b.com",
        name: "A",
        passwordHash: "hash",
      },
      company: {
        tmsCompanyId: "c1",
        legalName: "Acme Logistics Pvt Ltd",
        kind: "CLIENT",
      },
    });
  });
});
