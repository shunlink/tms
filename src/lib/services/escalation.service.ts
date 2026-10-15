import { prisma } from "../prisma";
import { managedAdvanceSourceFilter } from "../constants";
import { EVENT_TARGET_TEAM } from "../team-event-routing";

/** Important-event types created when a team misses an SLA deadline. */
export const SLA_ESCALATION_EVENT_TYPES = [
  "INVOICE_SLA_BREACHED",
  "ADVANCE_SLA_BREACHED",
  "POD_SLA_BREACHED",
  "BALANCE_PAYMENT_SLA_BREACHED",
] as const;

export type SlaEscalationCounts = {
  invoice: number;
  advance: number;
  balance: number;
  pod: number;
  total: number;
};

export type AdminEscalationRow = {
  id: string;
  key: string;
  category: string;
  title: string;
  teamCode: string;
  teamLabel: string;
  breachedAt: Date;
  deadlineAt: Date | null;
  href: string;
  indentId: string | null;
  indentNumber: string | null;
};

const TEAM_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  FINANCE: "Finance",
  OPERATIONS: "Operations",
  SALES: "Sales",
  VENDOR_TEAM: "Vendor",
};

function teamLabel(code: string) {
  return TEAM_LABELS[code] ?? code;
}

/** Count tasks escalated because a team missed the required SLA deadline. */
export async function countSlaEscalations(): Promise<SlaEscalationCounts> {
  const [invoice, advance, balance, pod] = await Promise.all([
    prisma.invoiceTask.count({ where: { status: "SLA_BREACHED" } }),
    prisma.advanceRequest.count({
      where: { ...managedAdvanceSourceFilter(), status: "SLA_BREACHED" },
    }),
    prisma.vendorBalancePaymentTask.count({ where: { status: "SLA_BREACHED" } }),
    prisma.indentPod.count({
      where: { status: "BAD_POD", resolutionStatus: "SLA_BREACHED" },
    }),
  ]);

  return { invoice, advance, balance, pod, total: invoice + advance + balance + pod };
}

function escalationHubHref(counts: SlaEscalationCounts): string {
  if (counts.invoice > 0) return "/invoices";
  if (counts.advance > 0) return "/advance-payments";
  if (counts.balance > 0) return "/balance-payments";
  if (counts.pod > 0) return "/pods?view=bad";
  return "/invoices";
}

/** Recent SLA escalations for the admin dashboard (newest breaches first). */
export async function listAdminEscalations(limit = 5): Promise<AdminEscalationRow[]> {
  const [invoiceRows, advanceRows, balanceRows, podRows] = await Promise.all([
    prisma.invoiceTask.findMany({
      where: { status: "SLA_BREACHED" },
      include: {
        trip: { select: { id: true, lrNumber: true } },
        indent: { select: { id: true, indentNumber: true } },
      },
    }),
    prisma.advanceRequest.findMany({
      where: { ...managedAdvanceSourceFilter(), status: "SLA_BREACHED" },
      include: {
        trip: {
          select: {
            lrNumber: true,
            indentId: true,
            indent: { select: { id: true, indentNumber: true } },
          },
        },
      },
    }),
    prisma.vendorBalancePaymentTask.findMany({
      where: { status: "SLA_BREACHED" },
      include: {
        trip: { select: { id: true, lrNumber: true } },
        indent: { select: { id: true, indentNumber: true } },
      },
    }),
    prisma.indentPod.findMany({
      where: { status: "BAD_POD", resolutionStatus: "SLA_BREACHED" },
      include: {
        indent: { select: { id: true, indentNumber: true } },
        trip: { select: { lrNumber: true } },
      },
    }),
  ]);

  const rows: AdminEscalationRow[] = [];

  for (const row of invoiceRows) {
    const teamCode = EVENT_TARGET_TEAM.INVOICE_SLA_BREACHED;
    rows.push({
      id: row.id,
      key: `invoice-${row.id}`,
      category: "INVOICE_SLA_BREACHED",
      title: `Invoice not created — ${row.trip.lrNumber}`,
      teamCode,
      teamLabel: teamLabel(teamCode),
      breachedAt: row.slaBreachedAt ?? row.escalatedAt ?? row.deadlineAt,
      deadlineAt: row.deadlineAt,
      href: `/trips/${row.tripId}`,
      indentId: row.indent?.id ?? row.indentId,
      indentNumber: row.indent?.indentNumber ?? null,
    });
  }

  for (const row of advanceRows) {
    const teamCode = EVENT_TARGET_TEAM.ADVANCE_SLA_BREACHED;
    rows.push({
      id: row.id,
      key: `advance-${row.id}`,
      category: "ADVANCE_SLA_BREACHED",
      title: `Advance SLA breached — ${row.requestNumber}${row.trip ? ` (${row.trip.lrNumber})` : ""}`,
      teamCode,
      teamLabel: teamLabel(teamCode),
      breachedAt: row.escalatedAt ?? row.deadlineAt ?? row.updatedAt,
      deadlineAt: row.deadlineAt,
      href: "/advance-payments",
      indentId: row.trip.indent?.id ?? row.trip.indentId,
      indentNumber: row.trip.indent?.indentNumber ?? null,
    });
  }

  for (const row of balanceRows) {
    const teamCode = EVENT_TARGET_TEAM.BALANCE_PAYMENT_SLA_BREACHED;
    rows.push({
      id: row.id,
      key: `balance-${row.id}`,
      category: "BALANCE_PAYMENT_SLA_BREACHED",
      title: `Balance payment SLA breached — ${row.trip.lrNumber}`,
      teamCode,
      teamLabel: teamLabel(teamCode),
      breachedAt: row.slaBreachedAt ?? row.escalatedAt ?? row.deadlineAt,
      deadlineAt: row.deadlineAt,
      href: `/trips/${row.tripId}`,
      indentId: row.indent?.id ?? row.indentId,
      indentNumber: row.indent?.indentNumber ?? null,
    });
  }

  for (const row of podRows) {
    const teamCode = EVENT_TARGET_TEAM.POD_SLA_BREACHED;
    rows.push({
      id: row.id,
      key: `pod-${row.id}`,
      category: "POD_SLA_BREACHED",
      title: `Bad POD unresolved — ${row.indent.indentNumber}${row.trip ? ` (${row.trip.lrNumber})` : ""}`,
      teamCode,
      teamLabel: teamLabel(teamCode),
      breachedAt: row.slaBreachedAt ?? row.escalatedAt ?? row.slaDeadlineAt ?? row.uploadedAt,
      deadlineAt: row.slaDeadlineAt,
      href: row.indentId ? `/indents/${row.indentId}` : "/pods?view=bad",
      indentId: row.indent.id,
      indentNumber: row.indent.indentNumber,
    });
  }

  return rows
    .sort((a, b) => b.breachedAt.getTime() - a.breachedAt.getTime())
    .slice(0, limit);
}

export { escalationHubHref };
