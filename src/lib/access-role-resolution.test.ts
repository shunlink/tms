import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "./permissions";

const mockFindUnique = vi.fn();
const mockRolePermissionFindMany = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    rolePermission: { findMany: (...args: unknown[]) => mockRolePermissionFindMany(...args) },
  },
}));

describe("getGrantedPermissions access modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRolePermissionFindMany.mockResolvedValue([]);
  });

  it("INHERIT_ROLE keeps finance defaults from code", async () => {
    mockFindUnique.mockResolvedValue({
      role: "FINANCE",
      accessMode: "INHERIT_ROLE",
      userPermissions: [],
      accessRoles: [],
    });
    const { getGrantedPermissions } = await import("./services/permission.service");
    const perms = await getGrantedPermissions("user-1");
    expect(perms.has("payment.approve")).toBe(true);
    expect(perms.has("indent.create")).toBe(true);
    expect(perms).toEqual(new Set(DEFAULT_ROLE_PERMISSIONS.FINANCE));
  });

  it("CUSTOM_ROLES uses only assigned bundle permissions", async () => {
    mockFindUnique.mockResolvedValue({
      role: "FINANCE",
      accessMode: "CUSTOM_ROLES",
      userPermissions: [],
      accessRoles: [
        {
          accessRole: {
            permissions: [
              { permission: { key: "payment.view" } },
              { permission: { key: "payment.process" } },
            ],
          },
        },
      ],
    });
    const { getGrantedPermissions } = await import("./services/permission.service");
    const perms = await getGrantedPermissions("user-2");
    expect(perms.has("payment.process")).toBe(true);
    expect(perms.has("payment.approve")).toBe(false);
    expect(perms.has("advance.decide")).toBe(false);
  });

  it("CUSTOM_ROLES applies user permission deny override", async () => {
    mockFindUnique.mockResolvedValue({
      role: "FINANCE",
      accessMode: "CUSTOM_ROLES",
      userPermissions: [{ granted: false, permission: { key: "payment.process" } }],
      accessRoles: [
        {
          accessRole: {
            permissions: [{ permission: { key: "payment.process" } }],
          },
        },
      ],
    });
    const { getGrantedPermissions } = await import("./services/permission.service");
    const perms = await getGrantedPermissions("user-3");
    expect(perms.has("payment.process")).toBe(false);
  });
});
