import { prisma } from "../prisma";
import { SLA_TYPES } from "../sla-types";

type DigestItem = {
  type: string;
  title: string;
  deadlineAt: Date;
  entityId: string;
  tripLabel?: string | null;
  indentLabel?: string | null;
};

function formatItem(item: DigestItem) {
  const ctx = [item.indentLabel, item.tripLabel].filter(Boolean).join(" · ");
  return `• ${item.title}${ctx ? ` (${ctx})` : ""} — overdue since ${item.deadlineAt.toLocaleString("en-IN")}`;
}

async function loadOverdueItems(): Promise<DigestItem[]> {
  const now = new Date();
  const items: DigestItem[] = [];

  const advances = await prisma.advanceRequest.findMany({
    where: {
      status: { in: ["PENDING_REVIEW", "NEGOTIATED", "APPROVED", "VENDOR_ACCEPTED", "PROCESSING", "SLA_BREACHED"] },
      deadlineAt: { lt: now },
    },
    include: { trip: { select: { lrNumber: true, indent: { select: { indentNumber: true } } } } },
    take: 100,
  });
  for (const row of advances) {
    items.push({
      type: SLA_TYPES.ADVANCE_REQUEST,
      title: `Advance ${row.requestNumber} pending`,
      deadlineAt: row.deadlineAt,
      entityId: row.id,
      tripLabel: row.trip.lrNumber,
      indentLabel: row.trip.indent?.indentNumber,
    });
  }

  const badPods = await prisma.indentPod.findMany({
    where: {
      status: "BAD_POD",
      resolutionStatus: { in: ["PENDING", "SLA_BREACHED"] },
      slaDeadlineAt: { lt: now },
    },
    include: {
      indent: { select: { indentNumber: true } },
      trip: { select: { lrNumber: true } },
    },
    take: 100,
  });
  for (const row of badPods) {
    items.push({
      type: SLA_TYPES.BAD_POD,
      title: `Bad POD unresolved`,
      deadlineAt: row.slaDeadlineAt!,
      entityId: row.id,
      tripLabel: row.trip?.lrNumber,
      indentLabel: row.indent.indentNumber,
    });
  }

  const invoices = await prisma.invoiceTask.findMany({
    where: { status: { in: ["PENDING", "SLA_BREACHED"] }, deadlineAt: { lt: now } },
    include: { trip: { select: { lrNumber: true, indent: { select: { indentNumber: true } } } } },
    take: 100,
  });
  for (const row of invoices) {
    items.push({
      type: SLA_TYPES.INVOICE,
      title: `Invoice task overdue`,
      deadlineAt: row.deadlineAt,
      entityId: row.id,
      tripLabel: row.trip.lrNumber,
      indentLabel: row.trip.indent?.indentNumber,
    });
  }

  const balances = await prisma.vendorBalancePaymentTask.findMany({
    where: { status: { in: ["PENDING", "SLA_BREACHED"] }, deadlineAt: { lt: now } },
    include: { trip: { select: { lrNumber: true, indent: { select: { indentNumber: true } } } } },
    take: 100,
  });
  for (const row of balances) {
    items.push({
      type: SLA_TYPES.BALANCE_PAYMENT,
      title: `Vendor balance payment overdue`,
      deadlineAt: row.deadlineAt,
      entityId: row.id,
      tripLabel: row.trip.lrNumber,
      indentLabel: row.trip.indent?.indentNumber,
    });
  }

  return items.sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime());
}

export async function sendOverdueTaskDigest() {
  const items = await loadOverdueItems();
  if (items.length === 0) return { sent: 0, items: 0 };

  const roles = (process.env.OVERDUE_DIGEST_RECIPIENT_ROLES ?? "ADMIN,SUPER_ADMIN")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: roles }, email: { not: null } },
    select: { email: true, name: true },
  });

  const recipients = users.map((u) => u.email!).filter(Boolean);
  if (recipients.length === 0) return { sent: 0, items: items.length };

  const body = [
    `TMS Overdue Tasks Digest (${items.length} item${items.length === 1 ? "" : "s"})`,
    "",
    ...items.map(formatItem),
    "",
    "Please review these items in the TMS dashboard.",
  ].join("\n");

  const subject = `TMS: ${items.length} overdue task${items.length === 1 ? "" : "s"} need attention`;
  const html = `<h2>TMS Overdue Tasks</h2><p>${items.length} task(s) have crossed their deadline:</p><ul>${items
    .map((i) => `<li>${formatItem(i)}</li>`)
    .join("")}</ul><p>Please review these in the TMS dashboard.</p>`;

  const { deliverEmail } = await import("../notify");
  let sent = 0;
  for (const to of recipients) {
    const result = await deliverEmail({ to, subject, body, html, entityType: "OVERDUE_DIGEST" });
    if (result.ok) sent += 1;
  }

  return { sent, items: items.length, recipients: recipients.length };
}
