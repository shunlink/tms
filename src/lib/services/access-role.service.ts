import { prisma } from "../prisma";
import type { PermissionKey } from "../permissions";

export const USER_ACCESS_MODES = ["INHERIT_ROLE", "CUSTOM_ROLES"] as const;
export type UserAccessMode = (typeof USER_ACCESS_MODES)[number];

/** Default named access role bundles — idempotent seed. */
export const DEFAULT_ACCESS_ROLES: {
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  permissions: PermissionKey[];
}[] = [
  {
    code: "DASHBOARD_VIEW",
    name: "Dashboard View",
    sortOrder: 10,
    permissions: ["dashboard.view"],
  },
  {
    code: "INDENT_CREATOR",
    name: "Indent Creator",
    description: "Create and edit indents",
    sortOrder: 20,
    permissions: ["indent.create", "indent.view", "indent.edit", "requirement.view"],
  },
  {
    code: "INDENT_RELEASE",
    name: "Indent Release",
    sortOrder: 25,
    permissions: ["indent.view", "indent.release"],
  },
  {
    code: "VENDOR_ALLOCATION",
    name: "Vendor Allocation",
    sortOrder: 30,
    permissions: ["indent.view", "indent.allocate", "indent.reallocate", "quote.view", "vendor.view"],
  },
  {
    code: "ONBOARDING_REQUESTS",
    name: "Onboarding requests",
    description: "Handle assisted client onboarding requests",
    sortOrder: 27,
    permissions: ["onboarding.ops", "client.view", "client.edit"],
  },
  {
    code: "ONBOARDING_APPROVAL",
    name: "Onboarding approval",
    description: "Approve submitted onboarding cases",
    sortOrder: 28,
    permissions: ["users.manage"],
  },
  {
    code: "ONBOARDING_OPS_FULL",
    name: "Onboarding (full)",
    description: "Requests queue and approval actions",
    sortOrder: 29,
    permissions: ["onboarding.ops", "client.view", "client.edit", "users.manage"],
  },
  {
    code: "PLACEMENT_OPS",
    name: "Placement Operations",
    sortOrder: 35,
    permissions: ["placement.view", "placement.update", "trip.view", "trip.edit"],
  },
  {
    code: "POD_UPLOAD",
    name: "POD Upload",
    sortOrder: 40,
    permissions: ["pod.upload", "pod.view"],
  },
  {
    code: "POD_APPROVER",
    name: "POD Approval",
    sortOrder: 45,
    permissions: ["pod.view", "pod.approve", "pod.manage"],
  },
  {
    code: "ADVANCE_DECIDER",
    name: "Advance Approval",
    sortOrder: 50,
    permissions: ["advance.view", "advance.decide"],
  },
  {
    code: "ADVANCE_PROCESSOR",
    name: "Advance Processing",
    sortOrder: 55,
    permissions: ["advance.view", "advance.process", "advance.markPaid"],
  },
  {
    code: "PAYMENT_VIEWER",
    name: "Payment Viewer",
    sortOrder: 60,
    permissions: ["payment.view", "trip.view"],
  },
  {
    code: "PAYMENT_APPROVER",
    name: "Payment Approval",
    sortOrder: 65,
    permissions: ["payment.view", "payment.approve"],
  },
  {
    code: "PAYMENT_PROCESSOR",
    name: "Payment Processing",
    sortOrder: 70,
    permissions: ["payment.view", "payment.create", "payment.process"],
  },
  {
    code: "CLIENT_PAYMENTS",
    name: "Client Payments",
    sortOrder: 75,
    permissions: ["client.payment.manage", "client.view"],
  },
  {
    code: "INVOICE_OPS",
    name: "Invoicing",
    sortOrder: 80,
    permissions: ["invoice.view", "invoice.create", "invoice.edit"],
  },
  {
    code: "FINANCIAL_NOTES",
    name: "Debit/Credit Notes",
    sortOrder: 85,
    permissions: [
      "financial_note.view",
      "financial_note.create",
      "financial_note.approve",
      "financial_note.issue",
      "financial_note.reverse",
    ],
  },
  {
    code: "ACCOUNTING_VIEW",
    name: "Accounting View",
    sortOrder: 90,
    permissions: [
      "accounting.coa.view",
      "accounting.journal.view",
      "accounting.period.view",
      "accounting.report.view",
      "accounting.subledger.view",
      "accounting.reconcile.view",
      "accounting.reconcile.bank.view",
    ],
  },
  {
    code: "ACCOUNTING_OPS",
    name: "Accounting Operations",
    sortOrder: 95,
    permissions: [
      "accounting.coa.manage",
      "accounting.journal.draft",
      "accounting.journal.post",
      "accounting.journal.reverse",
      "accounting.period.close",
      "accounting.period.reopen",
      "accounting.period.validate",
      "accounting.reconcile.bank.import",
      "accounting.reconcile.bank.match",
      "accounting.reconcile.gateway.import",
      "accounting.report.export",
      "accounting.reconcile.export",
    ],
  },
  {
    code: "USER_ADMIN",
    name: "User Administration",
    sortOrder: 100,
    permissions: ["users.manage", "team.manage"],
  },
  {
    code: "REPORTS_VIEW",
    name: "Reports",
    sortOrder: 110,
    permissions: ["reports.view"],
  },
  {
    code: "CLIENT_MASTER",
    name: "Client Master",
    description: "Partners → Clients: view list, add, and edit (sidebar + APIs)",
    sortOrder: 120,
    permissions: ["client.view", "client.edit"],
  },
  {
    code: "VENDOR_MASTER",
    name: "Vendor Master",
    description: "Partners → Vendors: view list, add, and edit (sidebar + APIs)",
    sortOrder: 130,
    permissions: ["vendor.view", "vendor.edit"],
  },
];

export async function syncDefaultAccessRoles() {
  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const def of DEFAULT_ACCESS_ROLES) {
    const role = await prisma.accessRole.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        description: def.description ?? null,
        sortOrder: def.sortOrder,
      },
      update: {
        name: def.name,
        description: def.description ?? null,
        sortOrder: def.sortOrder,
      },
    });

    const permissionIds = def.permissions
      .map((k) => permIdByKey.get(k))
      .filter((id): id is string => Boolean(id));

    await prisma.$transaction(async (tx) => {
      await tx.accessRolePermission.deleteMany({ where: { accessRoleId: role.id } });
      for (const permissionId of permissionIds) {
        await tx.accessRolePermission.create({
          data: { accessRoleId: role.id, permissionId },
        });
      }
    });
  }
}

export async function listAccessRoles(activeOnly = true) {
  return prisma.accessRole.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      permissions: { include: { permission: { select: { key: true, label: true, module: true } } } },
      _count: { select: { users: true } },
    },
  });
}

export async function getUserAccessRoleAssignment(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      accessMode: true,
      accessRoles: {
        orderBy: { sortOrder: "asc" },
        include: {
          accessRole: {
            include: {
              permissions: { include: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });
  return user;
}

export async function setUserAccessRoles(
  userId: string,
  accessMode: UserAccessMode,
  accessRoleIds: string[]
) {
  const uniqueIds = Array.from(new Set(accessRoleIds));
  if (accessMode === "CUSTOM_ROLES" && uniqueIds.length === 0) {
    throw new Error("At least one access role is required when using custom access roles");
  }

  const roles =
    uniqueIds.length > 0
      ? await prisma.accessRole.findMany({
          where: { id: { in: uniqueIds }, isActive: true },
          select: { id: true },
        })
      : [];
  if (uniqueIds.length > 0 && roles.length !== uniqueIds.length) {
    throw new Error("One or more access roles are invalid or inactive");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { accessMode },
    });
    await tx.userAccessRole.deleteMany({ where: { userId } });
    for (let i = 0; i < uniqueIds.length; i++) {
      await tx.userAccessRole.create({
        data: { userId, accessRoleId: uniqueIds[i], sortOrder: i },
      });
    }
  });
}
