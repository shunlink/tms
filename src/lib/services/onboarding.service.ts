import type { z } from "zod";
import { onboardingCreatedByLabel } from "../client-onboarding";
import {
  assertClientOnboardingMandatorySubmission,
  buildClientOnboardingSubmissionSnapshot,
  evaluateClientOnboardingSubmission,
  resolveClientAgreementUrl,
} from "../client-onboarding-submission";
import { ONBOARDING_CASE_STATUS } from "../onboarding-case-status";
import { prisma } from "../prisma";
import { listDocuments } from "./document.service";
import { updateClientProfile } from "./profile.service";
import type { clientSchema, clientShunlinkAssistSchema } from "../validation";
import { notifyBiddingOnboardingDecision } from "../integration/bidding/onboarding-decision";

export type OnboardingEntityType = "CLIENT" | "VENDOR" | "DRIVER" | "VEHICLE";

type ClientInput = z.infer<typeof clientSchema>;
type ShunlinkAssistInput = z.infer<typeof clientShunlinkAssistSchema>;

export async function getOnboardingCase(entityType: OnboardingEntityType, entityId: string) {
  return prisma.onboardingCase.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });
}

export async function getOnboardingStatus(entityType: OnboardingEntityType, entityId: string) {
  const case_ = await getOnboardingCase(entityType, entityId);
  return case_?.status ?? "PENDING";
}

export async function setClientOnboardingPreference(
  clientId: string,
  preference: "SELF" | "SHUNLINK"
) {
  const client = await prisma.client.update({
    where: { id: clientId },
    data: { onboardingPreference: preference },
  });
  return client;
}

export async function submitClientShunlinkAssist(
  clientId: string,
  payload: ShunlinkAssistInput
) {
  await updateClientProfile(clientId, {
    pan: payload.pan,
    gstin: payload.gstin,
    businessType: payload.businessType,
    bankName: payload.bankName,
    bankAccount: payload.bankAccount,
    bankIfsc: payload.bankIfsc,
    bankBranch: payload.bankBranch ?? null,
    accountHolder: payload.accountHolder,
  });

  const now = new Date();
  return prisma.onboardingCase.upsert({
    where: { entityType_entityId: { entityType: "CLIENT", entityId: clientId } },
    create: {
      entityType: "CLIENT",
      entityId: clientId,
      status: "PENDING_OPS_ONBOARDING",
      submittedAt: now,
    },
    update: {
      status: "PENDING_OPS_ONBOARDING",
      submittedAt: now,
      submittedById: null,
    },
  });
}

function formatAddressLine(addr: {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
}) {
  return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
}

async function loadClientOnboardingSubmissionSnapshot(clientId: string) {
  const c = await prisma.client.findFirst({
    where: { id: clientId },
    include: {
      commercial: { include: { bankAccount: true } },
      addresses: { include: { address: true } },
    },
  });
  if (!c) throw new Error("Client not found");

  const billing =
    c.addresses.find((a) => a.type === "BILLING") ??
    c.addresses.find((a) => a.isPrimary) ??
    c.addresses[0];
  const addr = billing?.address;
  const bank = c.commercial?.bankAccount;
  const documents = await listDocuments("CLIENT", clientId);

  return buildClientOnboardingSubmissionSnapshot({
    client: {
      name: c.name,
      legalName: c.legalName,
      businessType: c.businessType,
      industry: c.industry,
      website: c.website,
      gstin: c.gstin,
      pan: c.pan,
      cin: c.cin,
      msme: c.msme,
      contactName: c.contactName,
      phone: c.phone,
      altPhone: c.altPhone,
      email: c.email,
      accountsEmail: c.accountsEmail,
      billingAddress: addr ? formatAddressLine(addr) : null,
      addressLine1: addr?.line1 ?? null,
      addressLine2: addr?.line2 ?? null,
      city: addr?.city ?? null,
      state: addr?.state ?? null,
      pincode: addr?.pincode ?? null,
      country: addr?.country ?? null,
      bankName: bank?.bankName ?? null,
      bankAccount: bank?.accountNumber ?? null,
      bankIfsc: bank?.ifsc ?? null,
      bankBranch: bank?.branch ?? null,
      accountHolder: bank?.accountHolder ?? null,
    },
    documents,
  });
}

const CLIENT_SUBMITTABLE_STATUSES = new Set<string>([
  ONBOARDING_CASE_STATUS.PENDING,
  ONBOARDING_CASE_STATUS.REJECTED,
]);

const CLIENT_OPS_COMPLETABLE_STATUSES = new Set<string>([
  ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION,
  ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
  ONBOARDING_CASE_STATUS.PENDING_OPS_ONBOARDING,
]);

export async function finalizeClientOnboardingSubmission(
  clientId: string,
  submittedById: string | null,
  remarks?: string | null,
  options?: { allowOpsCompletion?: boolean }
) {
  const existing = await getOnboardingCase("CLIENT", clientId);
  if (existing) {
    const allowed = options?.allowOpsCompletion
      ? CLIENT_OPS_COMPLETABLE_STATUSES.has(existing.status)
      : CLIENT_SUBMITTABLE_STATUSES.has(existing.status);
    if (!allowed) {
      throw new Error("Onboarding cannot be submitted in the current state");
    }
  }

  const snapshot = await loadClientOnboardingSubmissionSnapshot(clientId);
  assertClientOnboardingMandatorySubmission(snapshot);
  const evaluation = evaluateClientOnboardingSubmission(snapshot);
  const agreementUrl = resolveClientAgreementUrl(snapshot);
  const now = new Date();

  return prisma.onboardingCase.upsert({
    where: { entityType_entityId: { entityType: "CLIENT", entityId: clientId } },
    create: {
      entityType: "CLIENT",
      entityId: clientId,
      status: evaluation.status,
      remarks: remarks ?? null,
      submittedAt: now,
      submittedById,
      agreementUrl,
    },
    update: {
      status: evaluation.status,
      remarks: remarks ?? null,
      submittedAt: now,
      submittedById,
      agreementUrl,
      ...(evaluation.status === ONBOARDING_CASE_STATUS.PENDING_APPROVAL
        ? {
            assignedEmployeeId: null,
            assignedAt: null,
            isSlaEscalated: false,
          }
        : {}),
    },
  });
}

export async function submitOnboardingByOps(
  clientId: string,
  opsUserId: string,
  profile: Partial<ClientInput>
) {
  const case_ = await getOnboardingCase("CLIENT", clientId);
  if (!case_ || !CLIENT_OPS_COMPLETABLE_STATUSES.has(case_.status)) {
    throw new Error("This client is not awaiting operations onboarding completion");
  }

  await updateClientProfile(clientId, profile);
  return finalizeClientOnboardingSubmission(clientId, opsUserId, null, {
    allowOpsCompletion: true,
  });
}

export async function submitOnboarding(
  entityType: OnboardingEntityType,
  entityId: string,
  remarks?: string | null,
  submittedById?: string | null
) {
  if (entityType === "CLIENT") {
    return finalizeClientOnboardingSubmission(entityId, submittedById ?? null, remarks);
  }

  const now = new Date();
  return prisma.onboardingCase.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: {
      entityType,
      entityId,
      status: "SUBMITTED",
      remarks: remarks ?? null,
      submittedAt: now,
      submittedById: submittedById ?? null,
    },
    update: {
      status: "SUBMITTED",
      remarks: remarks ?? null,
      submittedAt: now,
      submittedById: submittedById ?? null,
    },
  });
}

export async function reviewOnboarding(
  entityType: OnboardingEntityType,
  entityId: string,
  status: "APPROVED" | "REJECTED",
  reviewedById: string,
  remarks?: string | null
) {
  const case_ = await prisma.onboardingCase.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: {
      entityType,
      entityId,
      status,
      remarks: remarks ?? null,
      reviewedAt: new Date(),
      reviewedById,
    },
    update: {
      status,
      remarks: remarks ?? null,
      reviewedAt: new Date(),
      reviewedById,
    },
  });

  if (entityType === "CLIENT" || entityType === "VENDOR") {
    const biddingApplicationId = await resolveBiddingApplicationId(entityType, entityId);
    if (biddingApplicationId) {
      try {
        await notifyBiddingOnboardingDecision({
          biddingApplicationId,
          status,
          remarks: remarks ?? null,
        });
      } catch (e) {
        console.error("[onboarding] Bidding onboarding-decision notify failed:", e);
      }
    }
  }

  return case_;
}

async function resolveBiddingApplicationId(
  entityType: "CLIENT" | "VENDOR",
  entityId: string
): Promise<string | null> {
  if (entityType === "CLIENT") {
    const client = await prisma.client.findFirst({
      where: { id: entityId },
      select: { biddingApplicationId: true },
    });
    return client?.biddingApplicationId?.trim() || null;
  }
  const vendor = await prisma.vendor.findFirst({
    where: { id: entityId },
    select: { biddingApplicationId: true },
  });
  return vendor?.biddingApplicationId?.trim() || null;
}

const CLIENT_REQUEST_QUEUE_STATUSES = [
  ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION,
  ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
  ONBOARDING_CASE_STATUS.PENDING_OPS_ONBOARDING,
] as const;

export type OnboardingRequestListRow = {
  clientId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  businessType: string | null;
  waitingSince: Date;
  status: string;
  isSlaEscalated: boolean;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  assignedAt: Date | null;
};

async function mapOnboardingRequestCases(
  cases: {
    entityId: string;
    status: string;
    submittedAt: Date | null;
    createdAt: Date;
    isSlaEscalated: boolean;
    assignedEmployeeId: string | null;
    assignedAt: Date | null;
  }[]
): Promise<OnboardingRequestListRow[]> {
  const clientIds = cases.map((c) => c.entityId);
  const clients =
    clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: {
            id: true,
            name: true,
            contactName: true,
            phone: true,
            email: true,
            businessType: true,
          },
        })
      : [];
  const byId = new Map(clients.map((c) => [c.id, c]));

  const assigneeIds = cases.map((c) => c.assignedEmployeeId).filter(Boolean) as string[];
  const assignees =
    assigneeIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const assigneeById = new Map(assignees.map((u) => [u.id, u]));

  return cases.map((c) => {
    const client = byId.get(c.entityId);
    const assignee = c.assignedEmployeeId ? assigneeById.get(c.assignedEmployeeId) : null;
    return {
      clientId: c.entityId,
      name: client?.name ?? c.entityId,
      contactName: client?.contactName ?? null,
      phone: client?.phone ?? null,
      email: client?.email ?? null,
      businessType: client?.businessType ?? null,
      waitingSince: c.submittedAt ?? c.createdAt,
      status: c.status,
      isSlaEscalated: c.isSlaEscalated,
      assignedEmployeeId: c.assignedEmployeeId,
      assignedEmployeeName: assignee?.name ?? assignee?.email ?? null,
      assignedAt: c.assignedAt,
    };
  });
}

/** Admin queue: partial submissions and in-progress employee assignments. */
export async function listAdminOnboardingRequests() {
  await escalateOverdueClientOnboardingAssignments();
  const cases = await prisma.onboardingCase.findMany({
    where: {
      entityType: "CLIENT",
      status: { in: [...CLIENT_REQUEST_QUEUE_STATUSES] },
    },
    orderBy: [{ isSlaEscalated: "desc" }, { submittedAt: "asc" }],
  });
  return mapOnboardingRequestCases(cases);
}

/** Employee queue: clients assigned to this user only. */
export async function listEmployeeOnboardingRequests(employeeUserId: string) {
  const cases = await prisma.onboardingCase.findMany({
    where: {
      entityType: "CLIENT",
      status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
      assignedEmployeeId: employeeUserId,
    },
    orderBy: { assignedAt: "asc" },
  });
  return mapOnboardingRequestCases(cases);
}

/** @deprecated Use listAdminOnboardingRequests or listEmployeeOnboardingRequests */
export async function listShunlinkOpsQueue() {
  return listAdminOnboardingRequests();
}

export async function countOnboardingRequestsForUser(userId: string, canViewAll: boolean) {
  if (canViewAll) {
    return prisma.onboardingCase.count({
      where: {
        entityType: "CLIENT",
        status: { in: [...CLIENT_REQUEST_QUEUE_STATUSES] },
      },
    });
  }
  return prisma.onboardingCase.count({
    where: {
      entityType: "CLIENT",
      status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
      assignedEmployeeId: userId,
    },
  });
}

export async function countShunlinkOpsQueue() {
  return prisma.onboardingCase.count({
    where: {
      entityType: "CLIENT",
      status: { in: [...CLIENT_REQUEST_QUEUE_STATUSES] },
    },
  });
}

const ONBOARDING_ASSIGNEE_ROLES = ["SALES", "OPERATIONS"] as const;

export async function listOnboardingAssignees() {
  return prisma.user.findMany({
    where: {
      role: { in: [...ONBOARDING_ASSIGNEE_ROLES] },
      clientId: null,
      vendorId: null,
      driverId: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

export const CLIENT_ONBOARDING_ASSIGNMENT_SLA_MS = 24 * 60 * 60 * 1000;

/** Mark employee assignments breached after 24h without completion. */
export async function escalateOverdueClientOnboardingAssignments() {
  const breachBefore = new Date(Date.now() - CLIENT_ONBOARDING_ASSIGNMENT_SLA_MS);
  const result = await prisma.onboardingCase.updateMany({
    where: {
      entityType: "CLIENT",
      status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
      isSlaEscalated: false,
      assignedAt: { not: null, lt: breachBefore },
    },
    data: { isSlaEscalated: true },
  });
  return result.count;
}

export async function assignClientOnboardingToEmployee(
  clientId: string,
  employeeUserId: string
) {
  const case_ = await getOnboardingCase("CLIENT", clientId);
  if (!case_ || case_.status !== ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION) {
    throw new Error("Only partial client submissions can be assigned to an employee");
  }

  const employee = await prisma.user.findFirst({
    where: {
      id: employeeUserId,
      role: { in: [...ONBOARDING_ASSIGNEE_ROLES] },
      clientId: null,
      vendorId: null,
      driverId: null,
    },
    select: { id: true },
  });
  if (!employee) {
    throw new Error("Assignee must be a Sales or Operations employee");
  }

  const now = new Date();
  return prisma.onboardingCase.update({
    where: { entityType_entityId: { entityType: "CLIENT", entityId: clientId } },
    data: {
      status: ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
      assignedEmployeeId: employeeUserId,
      assignedAt: now,
      isSlaEscalated: false,
    },
  });
}

export async function listOnboardingQueue() {
  const cases = await prisma.onboardingCase.findMany({
    where: {
      entityType: { not: "DRIVER" },
      OR: [
        { status: ONBOARDING_CASE_STATUS.PENDING_APPROVAL },
        { status: "SUBMITTED" },
      ],
    },
    orderBy: { submittedAt: "desc" },
  });

  const clientIds = cases.filter((c) => c.entityType === "CLIENT").map((c) => c.entityId);
  const clients =
    clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true, onboardingPreference: true },
        })
      : [];
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const submitterIds = cases.map((c) => c.submittedById).filter(Boolean) as string[];
  const submitters =
    submitterIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: submitterIds } },
          select: { id: true, role: true },
        })
      : [];
  const submitterById = new Map(submitters.map((u) => [u.id, u]));

  const results = [];
  for (const c of cases) {
    let name = c.entityId;
    let createdByLabel: "Client" | "Team" | null = null;

    if (c.entityType === "CLIENT") {
      const client = clientById.get(c.entityId);
      name = client?.name ?? name;
      const submitter = c.submittedById ? submitterById.get(c.submittedById) : null;
      createdByLabel = onboardingCreatedByLabel(
        client?.onboardingPreference,
        submitter?.role
      );
    } else if (c.entityType === "VENDOR") {
      const vendor = await prisma.vendor.findFirst({ where: { id: c.entityId } });
      name = vendor?.name ?? name;
    } else if (c.entityType === "VEHICLE") {
      const vehicle = await prisma.vehicle.findFirst({ where: { id: c.entityId } });
      name = vehicle?.registrationNumber ?? name;
    }

    results.push({
      id: c.entityId,
      type: c.entityType.toLowerCase(),
      name,
      status: c.status,
      remarks: c.remarks,
      submittedAt: c.submittedAt,
      createdByLabel,
    });
  }
  return results;
}
