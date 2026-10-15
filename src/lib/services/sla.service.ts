import { prisma } from "../prisma";
import {
  SLA_ENTITY_NAMES,
  SLA_TARGET_TEAMS,
  type SlaType,
} from "../sla-types";

export type RegisterSlaInput = {
  type: SlaType;
  entityId: string;
  startAt: Date;
  deadlineAt: Date;
  tripId?: string | null;
  indentId?: string | null;
};

export async function registerSlaTask(input: RegisterSlaInput) {
  const entity = SLA_ENTITY_NAMES[input.type];
  const targetTeamCode = SLA_TARGET_TEAMS[input.type];

  return prisma.slaTask.upsert({
    where: { entity_entityId: { entity, entityId: input.entityId } },
    create: {
      type: input.type,
      entity,
      entityId: input.entityId,
      tripId: input.tripId ?? null,
      indentId: input.indentId ?? null,
      startAt: input.startAt,
      deadlineAt: input.deadlineAt,
      status: "ACTIVE",
      targetTeamCode,
    },
    update: {
      startAt: input.startAt,
      deadlineAt: input.deadlineAt,
      tripId: input.tripId ?? null,
      indentId: input.indentId ?? null,
      status: "ACTIVE",
      breachedAt: null,
      resolvedAt: null,
      escalatedAt: null,
      targetTeamCode,
    },
  });
}

export async function resolveSlaTask(type: SlaType, entityId: string, resolvedAt = new Date()) {
  const entity = SLA_ENTITY_NAMES[type];
  await prisma.slaTask.updateMany({
    where: { entity, entityId, status: { in: ["ACTIVE", "BREACHED"] } },
    data: { status: "RESOLVED", resolvedAt },
  });
}

export async function markSlaTaskBreached(
  type: SlaType,
  entityId: string,
  breachedAt = new Date(),
  importantEventId?: string | null
) {
  const entity = SLA_ENTITY_NAMES[type];
  await prisma.slaTask.updateMany({
    where: { entity, entityId },
    data: {
      status: "BREACHED",
      breachedAt,
      escalatedAt: breachedAt,
      ...(importantEventId ? { importantEventId } : {}),
    },
  });
}

export async function cancelSlaTask(type: SlaType, entityId: string) {
  const entity = SLA_ENTITY_NAMES[type];
  await prisma.slaTask.updateMany({
    where: { entity, entityId, status: { in: ["ACTIVE", "BREACHED"] } },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });
}

export async function countActiveSlaTasks(type?: SlaType) {
  return prisma.slaTask.count({
    where: {
      status: "ACTIVE",
      ...(type ? { type } : {}),
    },
  });
}

export async function countBreachedSlaTasks(type?: SlaType) {
  return prisma.slaTask.count({
    where: {
      status: "BREACHED",
      ...(type ? { type } : {}),
    },
  });
}

export async function listOverdueActiveSlaTasks(now = new Date()) {
  return prisma.slaTask.findMany({
    where: {
      status: "ACTIVE",
      deadlineAt: { lt: now },
      escalatedAt: null,
    },
    orderBy: { deadlineAt: "asc" },
  });
}
