import { prisma } from "../prisma";
import type { TeamCode } from "../teams";

type NotifyInput = {
  body: string;
  subject?: string;
  entityType: string;
  entityId: string;
};

async function deliverWhatsApp(to: string, input: NotifyInput) {
  const { deliverNow } = await import("../notify");
  await deliverNow({
    channel: "WHATSAPP",
    to,
    body: input.body,
    entityType: input.entityType,
    entityId: input.entityId,
  });
}

async function deliverEmail(to: string, input: NotifyInput) {
  const { deliverEmail: sendEmail } = await import("../notify");
  await sendEmail({
    to,
    subject: input.subject ?? "TMS Alert",
    body: input.body,
    entityType: input.entityType,
    entityId: input.entityId,
  });
}

async function recipientsForRoles(roles: string[], channel: "WHATSAPP" | "EMAIL") {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: roles } },
    select: { phone: true, email: true },
  });
  const out = new Set<string>();
  for (const u of users) {
    const to = channel === "EMAIL" ? u.email : u.phone ?? u.email;
    if (to) out.add(to);
  }
  return Array.from(out);
}

async function recipientsForTeam(teamCode: TeamCode, channel: "WHATSAPP" | "EMAIL") {
  const users = await prisma.user.findMany({
    where: { isActive: true, team: { code: teamCode } },
    select: { phone: true, email: true },
  });
  const out = new Set<string>();
  for (const u of users) {
    const to = channel === "EMAIL" ? u.email : u.phone ?? u.email;
    if (to) out.add(to);
  }
  return Array.from(out);
}

async function notifyRolesMultiChannel(roles: string[], input: NotifyInput) {
  const whatsapp = await recipientsForRoles(roles, "WHATSAPP");
  const emails = await recipientsForRoles(roles, "EMAIL");

  for (const to of whatsapp) await deliverWhatsApp(to, input);
  for (const to of emails) await deliverEmail(to, input);
}

async function notifyTeamMultiChannel(teamCode: TeamCode, input: NotifyInput) {
  const byTeamWa = await recipientsForTeam(teamCode, "WHATSAPP");
  const byTeamEmail = await recipientsForTeam(teamCode, "EMAIL");
  const byRole =
    teamCode === "FINANCE"
      ? {
          wa: await recipientsForRoles(["FINANCE", "ADMIN", "SUPER_ADMIN"], "WHATSAPP"),
          email: await recipientsForRoles(["FINANCE", "ADMIN", "SUPER_ADMIN"], "EMAIL"),
        }
      : teamCode === "OPERATIONS"
        ? {
            wa: await recipientsForRoles(["OPERATIONS", "ADMIN", "SUPER_ADMIN"], "WHATSAPP"),
            email: await recipientsForRoles(["OPERATIONS", "ADMIN", "SUPER_ADMIN"], "EMAIL"),
          }
        : { wa: [], email: [] };

  const whatsapp = Array.from(new Set([...byTeamWa, ...byRole.wa]));
  const emails = Array.from(new Set([...byTeamEmail, ...byRole.email]));

  for (const to of whatsapp) await deliverWhatsApp(to, input);
  for (const to of emails) await deliverEmail(to, input);
}

/** Notify users by internal role (e.g. ADMIN, FINANCE). */
export async function notifyRoles(roles: string[], input: NotifyInput) {
  await notifyRolesMultiChannel(roles, input);
}

/** Notify all active members of an internal team. */
export async function notifyTeam(teamCode: TeamCode, input: NotifyInput) {
  await notifyTeamMultiChannel(teamCode, input);
}

export async function notifyFinanceUsers(body: string, entityType: string, entityId: string) {
  await notifyTeam("FINANCE", { body, entityType, entityId, subject: "TMS Finance Alert" });
}

export async function notifyAdminUsers(body: string, entityType: string, entityId: string) {
  await notifyRoles(["ADMIN", "SUPER_ADMIN"], {
    body,
    entityType,
    entityId,
    subject: "TMS Admin Alert",
  });
}

export async function notifyOperationsUsers(body: string, entityType: string, entityId: string) {
  await notifyTeam("OPERATIONS", { body, entityType, entityId, subject: "TMS Operations Alert" });
}
