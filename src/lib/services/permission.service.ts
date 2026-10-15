import { prisma } from "../prisma";
import {
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  type PermissionKey,
} from "../permissions";

export { PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS, type PermissionKey };

export async function getGrantedPermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      userPermissions: {
        select: { permissionId: true, granted: true, permission: { select: { key: true } } },
      },
    },
  });
  if (!user) return new Set();

  if (user.role === "SUPER_ADMIN") return new Set<string>(PERMISSION_KEYS);

  const granted = new Set<string>();

  // Code defaults always apply so new permissions (e.g. pod.view for FINANCE) ship without re-seed.
  for (const p of DEFAULT_ROLE_PERMISSIONS[user.role] ?? []) granted.add(p);

  const rolePerms = await prisma.rolePermission.findMany({
    where: { role: user.role },
    include: { permission: { select: { key: true } } },
  });
  for (const rp of rolePerms) granted.add(rp.permission.key);

  for (const up of user.userPermissions) {
    if (up.granted) granted.add(up.permission.key);
    else granted.delete(up.permission.key);
  }

  return granted;
}

export async function hasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
  return (await getGrantedPermissions(userId)).has(permission);
}

export async function listPermissions() {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { label: "asc" }],
    include: { rolePermissions: true },
  });
  return permissions;
}

export async function ensurePermissions() {
  const definitions: { key: PermissionKey; label: string; module: string }[] = [
    { key: "dashboard.view", label: "View Dashboard", module: "Dashboard" },
    { key: "indent.create", label: "Create Indent", module: "Indent" },
    { key: "indent.view", label: "View Indent", module: "Indent" },
    { key: "indent.edit", label: "Edit Indent", module: "Indent" },
    { key: "indent.release", label: "Release Indent", module: "Indent" },
    { key: "indent.allocate", label: "Allocate Vendor", module: "Indent" },
    { key: "indent.reallocate", label: "Reallocate Vendor", module: "Indent" },
    { key: "indent.cancel", label: "Cancel Indent", module: "Indent" },
    { key: "requirement.view", label: "View Requirements", module: "Requirement" },
    { key: "requirement.create", label: "Create Requirement", module: "Requirement" },
    { key: "client.view", label: "View Clients", module: "Client" },
    { key: "client.edit", label: "Edit Clients", module: "Client" },
    { key: "vendor.view", label: "View Vendors", module: "Vendor" },
    { key: "vendor.edit", label: "Edit Vendors", module: "Vendor" },
    { key: "quote.view", label: "View Quotes", module: "Quote" },
    { key: "quote.submit", label: "Submit Quote", module: "Quote" },
    { key: "advance.view", label: "View Advance", module: "Advance" },
    { key: "advance.decide", label: "Decide Advance", module: "Advance" },
    { key: "advance.markPaid", label: "Mark Advance Paid", module: "Advance" },
    { key: "advance.process", label: "Process Advance Payment", module: "Advance" },
    { key: "advance.request", label: "Request Trip Advance", module: "Advance" },
    { key: "placement.view", label: "View Placement", module: "Placement" },
    { key: "placement.update", label: "Update Placement", module: "Placement" },
    { key: "trip.view", label: "View Trips", module: "Trip" },
    { key: "trip.edit", label: "Edit Trips", module: "Trip" },
    { key: "vehicle.view", label: "View Vehicles", module: "Vehicle" },
    { key: "vehicle.edit", label: "Edit Vehicles", module: "Vehicle" },
    { key: "driver.view", label: "View Drivers", module: "Driver" },
    { key: "driver.create", label: "Create Driver", module: "Driver" },
    { key: "driver.verify", label: "Verify Driver", module: "Driver" },
    { key: "pod.upload", label: "Upload POD", module: "POD" },
    { key: "pod.view", label: "View POD", module: "POD" },
    { key: "pod.approve", label: "Approve POD", module: "POD" },
    { key: "pod.manage", label: "Manage Bad POD", module: "POD" },
    { key: "tracking.view", label: "View Tracking", module: "Tracking" },
    { key: "tracking.post", label: "Post Tracking", module: "Tracking" },
    { key: "invoice.view", label: "View Invoices", module: "Finance" },
    { key: "invoice.create", label: "Create Invoices", module: "Finance" },
    { key: "invoice.edit", label: "Edit Invoices", module: "Finance" },
    { key: "payment.view", label: "View Vendor Payments", module: "Finance" },
    { key: "payment.create", label: "Create Vendor Payments", module: "Finance" },
    { key: "payment.process", label: "Process Vendor Payments", module: "Finance" },
    { key: "client.payment.manage", label: "Manage Client Payments", module: "Finance" },
    { key: "users.manage", label: "Manage Users", module: "Users" },
    { key: "team.manage", label: "Manage Teams", module: "Users" },
    { key: "roles.manage", label: "Manage Roles", module: "Roles" },
    { key: "permissions.manage", label: "Manage Permissions", module: "Permissions" },
    { key: "audit.view", label: "View Audit Log", module: "Audit" },
    { key: "events.manage", label: "Manage Escalations", module: "Events" },
    { key: "reports.view", label: "View Reports", module: "Reports" },
    { key: "notifications.manage", label: "Manage Notifications", module: "Notifications" },
    { key: "accounting.coa.view", label: "View Chart of Accounts", module: "Accounting" },
    { key: "accounting.coa.manage", label: "Manage Chart of Accounts", module: "Accounting" },
    { key: "accounting.journal.view", label: "View Journals", module: "Accounting" },
    { key: "accounting.journal.draft", label: "Create Draft Journals", module: "Accounting" },
    { key: "accounting.journal.post", label: "Post Journals", module: "Accounting" },
    { key: "accounting.journal.reverse", label: "Reverse Posted Journals", module: "Accounting" },
    { key: "accounting.period.view", label: "View Accounting Periods", module: "Accounting" },
    { key: "accounting.period.close", label: "Close Accounting Periods", module: "Accounting" },
    { key: "accounting.period.reopen", label: "Reopen Accounting Periods", module: "Accounting" },
    { key: "accounting.report.view", label: "View GL Financial Reports", module: "Accounting" },
    { key: "accounting.report.export", label: "Export GL Financial Reports", module: "Accounting" },
    { key: "accounting.subledger.view", label: "View Vendor/Client Subledgers", module: "Accounting" },
    { key: "accounting.reconcile.view", label: "View Reconciliation Dashboard", module: "Accounting" },
    { key: "accounting.reconcile.bank.import", label: "Import Bank Statements", module: "Accounting" },
    { key: "accounting.reconcile.bank.view", label: "View Bank Reconciliation", module: "Accounting" },
    { key: "accounting.reconcile.bank.match", label: "Confirm Bank Reconciliation Matches", module: "Accounting" },
    { key: "accounting.reconcile.gateway.import", label: "Import Gateway Settlement Reports", module: "Accounting" },
    { key: "accounting.reconcile.export", label: "Export Reconciliation Reports", module: "Accounting" },
    { key: "accounting.period.validate", label: "Run Period Close Validation", module: "Accounting" },
    { key: "financial_note.view", label: "View Debit/Credit Notes", module: "Finance" },
    { key: "financial_note.create", label: "Create Debit/Credit Notes", module: "Finance" },
    { key: "financial_note.approve", label: "Approve Debit/Credit Notes", module: "Finance" },
    { key: "financial_note.issue", label: "Issue Debit/Credit Notes", module: "Finance" },
    { key: "financial_note.reverse", label: "Reverse Issued Notes", module: "Finance" },
  ];

  for (const d of definitions) {
    await prisma.permission.upsert({ where: { key: d.key }, create: d, update: d });
  }

  await syncDefaultRolePermissions();
}

/** Keep RolePermission rows aligned with DEFAULT_ROLE_PERMISSIONS (idempotent). */
export async function syncDefaultRolePermissions() {
  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const [role, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (role === "SUPER_ADMIN") continue;
    for (const key of keys) {
      const permissionId = permIdByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId } },
        create: { role, permissionId },
        update: {},
      });
    }
  }
}
