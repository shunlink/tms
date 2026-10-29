import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { nextNumber } from "../sequence";
import { allocateVendorInTransaction } from "./allocation.service";
import { uploadDocument, ALLOWED_DOCUMENT_TYPES } from "./document.service";
import { getVendorTrips, getVendorTripDetail } from "../queries";
import { computeOutstandingVendorPayables } from "./vendor-payables.service";
import { listVendorPayments } from "./vendor-payment.service";
import type {
  OnboardingSyncPayload,
  OnboardingApprovedPayload,
  AwardHandoffPayload,
} from "../integration/bidding/schemas";
import { fetchBiddingDocument, resolveBiddingDocumentUrl } from "../integration/bidding/document-fetch";
import { partyNotLinkedError } from "../integration/bidding/errors";
import { resolveAwardCargo } from "../integration/bidding/vehicle-mapping";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";
import { PLACEMENT_DEADLINE_MS } from "../constants";
import { resolveVendorDisplayStatus } from "../vendor-trip-sync";

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function mapBiddingDocumentType(raw: string): string {
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const aliases: Record<string, string> = {
    GST_CERT: "GST",
    GST_CERTIFICATE: "GST",
    PAN_CARD: "PAN",
    AADHAR: "AADHAAR",
    AADHAAR_CARD: "AADHAAR",
    CANCELLED_CHEQUE: "BANK_PROOF",
    BANK_STATEMENT: "BANK_PROOF",
    DRIVING_LICENSE: "LICENSE",
  };
  const mapped = aliases[normalized] ?? normalized;
  return ALLOWED_DOCUMENT_TYPES.includes(mapped) ? mapped : "OTHER";
}

async function importSnapshotDocuments(
  ownerType: "client" | "vendor",
  ownerId: string,
  documents: OnboardingApprovedPayload["snapshot"]["documents"]
) {
  for (const doc of documents ?? []) {
    try {
      const url = resolveBiddingDocumentUrl(doc);
      if (!url) continue;
      const res = await fetchBiddingDocument(url);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      await uploadDocument({
        ownerType,
        ownerId,
        documentType: mapBiddingDocumentType(doc.documentType),
        fileName: doc.fileName,
        mimeType: doc.mimeType ?? res.headers.get("content-type") ?? undefined,
        sizeBytes: buffer.length,
        buffer,
        uploadedById: null,
      });
    } catch {
      // best-effort
    }
  }
}

async function upsertRegisteredAddress(
  tx: Prisma.TransactionClient,
  partyType: "CLIENT" | "VENDOR",
  partyId: string,
  addr: OnboardingApprovedPayload["snapshot"]["registeredAddress"]
) {
  if (!addr?.line1 && !addr?.city) return;
  const address = await tx.address.create({
    data: {
      line1: addr.line1 ?? addr.city ?? "—",
      line2: addr.line2 ?? null,
      city: addr.city ?? "—",
      state: addr.state ?? "—",
      pincode: addr.pincode ?? "000000",
      country: addr.country ?? "India",
    },
  });
  if (partyType === "CLIENT") {
    await tx.clientAddress.create({
      data: { clientId: partyId, addressId: address.id, type: "BILLING", isPrimary: true },
    });
  } else {
    await tx.vendorAddress.create({
      data: { vendorId: partyId, addressId: address.id, type: "REGISTERED", isPrimary: true },
    });
  }
}

async function upsertBankCommercial(
  tx: Prisma.TransactionClient,
  partyType: "CLIENT" | "VENDOR",
  partyId: string,
  bank: OnboardingApprovedPayload["snapshot"]["bank"]
) {
  if (!bank?.accountNumber && !bank?.ifsc) return;
  const bankAccount = await tx.bankAccount.create({
    data: {
      accountHolder: bank.accountHolder ?? null,
      bankName: bank.bankName ?? null,
      accountNumber: bank.accountNumber ?? null,
      ifsc: bank.ifsc ?? null,
      branch: bank.branch ?? null,
      upiId: bank.upiId ?? null,
    },
  });
  if (partyType === "CLIENT") {
    await tx.clientCommercial.upsert({
      where: { clientId: partyId },
      create: { clientId: partyId, bankAccountId: bankAccount.id },
      update: { bankAccountId: bankAccount.id },
    });
  } else {
    await tx.vendorCommercial.upsert({
      where: { vendorId: partyId },
      create: { vendorId: partyId, bankAccountId: bankAccount.id },
      update: { bankAccountId: bankAccount.id },
    });
  }
}

export async function resolveVendorIdByBiddingCompany(biddingCompanyId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { biddingCompanyId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return vendor?.id ?? null;
}

/** Map a Bidding vendor submitter to a TMS portal User id (FK-safe). */
export async function resolveVendorPortalActorForBidding(
  vendorId: string,
  requestedByEmail?: string | null,
): Promise<SessionUser | null> {
  const email = requestedByEmail?.trim();
  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: {
        vendorId,
        role: "VENDOR",
        isActive: true,
        email: { equals: email, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (byEmail) {
      return { id: byEmail.id, role: "VENDOR", vendorId };
    }
  }

  const fallback = await prisma.user.findFirst({
    where: { vendorId, role: "VENDOR", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return fallback ? { id: fallback.id, role: "VENDOR", vendorId } : null;
}

export async function resolveClientIdByBiddingCompany(biddingCompanyId: string) {
  const client = await prisma.client.findFirst({
    where: { biddingCompanyId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return client?.id ?? null;
}

export async function listBiddingClientInvoices(clientId: string) {
  const { getClientInvoices } = await import("../queries");
  const invoices = await getClientInvoices(clientId);
  return invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    tripCount: inv.trips,
    subTotalInr: inv.subTotal,
    gstAmountInr: inv.gstAmount,
    totalAmountInr: inv.totalAmount,
    paidAmountInr: inv.paidAmount,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    status: inv.status,
    outstandingInr: Math.max(0, inv.totalAmount - inv.paidAmount),
  }));
}

export async function getBiddingClientInvoiceDetail(clientId: string, invoiceId: string) {
  const { getInvoiceDetail } = await import("../queries");
  const { buildInvoicePrintHtml, loadInvoicePrintSnapshot } = await import(
    "./invoice-document.service"
  );
  const { CLIENT_HIDDEN_INVOICE_STATUSES } = await import("../client-trip-sync");

  const inv = await getInvoiceDetail(invoiceId.trim());
  if (!inv || inv.client.id !== clientId || CLIENT_HIDDEN_INVOICE_STATUSES.includes(inv.status)) {
    return null;
  }

  const snapshot = await loadInvoicePrintSnapshot(invoiceId.trim());
  if (!snapshot) return null;

  const printHtml = await buildInvoicePrintHtml(invoiceId.trim());

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    status: inv.status,
    subTotalInr: inv.subTotal,
    gstAmountInr: inv.gstAmount,
    totalAmountInr: inv.totalAmount,
    paidAmountInr: inv.paidAmount,
    outstandingInr: Math.max(0, inv.totalAmount - inv.paidAmount),
    printHtml,
    snapshot: {
      invoiceNumber: snapshot.invoiceNumber,
      totalAmount: snapshot.totalAmount,
      paidAmount: snapshot.paidAmount,
      status: snapshot.status,
    },
    payments: inv.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt instanceof Date ? p.paidAt.toISOString() : String(p.paidAt),
      paymentMode: p.paymentMode,
      referenceNo: p.referenceNo,
      chequeNumber: p.chequeNumber,
      recordedByName: p.recordedBy?.name ?? null,
    })),
  };
}

export async function getBiddingClientInvoicePdfBytes(clientId: string, invoiceId: string) {
  const { getInvoiceDetail } = await import("../queries");
  const { generateInvoicePdfBytes } = await import("./invoice-document.service");
  const { CLIENT_HIDDEN_INVOICE_STATUSES } = await import("../client-trip-sync");

  const inv = await getInvoiceDetail(invoiceId.trim());
  if (!inv || inv.client.id !== clientId || CLIENT_HIDDEN_INVOICE_STATUSES.includes(inv.status)) {
    return null;
  }

  const pdf = await generateInvoicePdfBytes(invoiceId.trim());
  return { invoiceNumber: inv.invoiceNumber, pdf };
}

export async function listBiddingClientPayments(clientId: string) {
  const { listClientPayments } = await import("./client-payment.service");
  const payments = await listClientPayments({ clientId, limit: 100 });
  return payments.map((p) => ({
    id: p.id,
    paymentType: p.paymentType,
    amountInr: p.amount,
    paidAt: p.paidAt,
    paymentMode: p.paymentMode,
    referenceNo: p.referenceNo,
    invoiceNumber: p.invoice?.invoiceNumber ?? null,
    invoiceId: p.invoiceId,
    tripLrNumber: p.trip?.lrNumber ?? null,
    indentNumber: p.indent?.indentNumber ?? null,
    notes: p.notes,
  }));
}

function syncStatus(payload: OnboardingSyncPayload) {
  return payload.status ?? "APPROVED";
}

function submittedAtFromPayload(payload: OnboardingSyncPayload) {
  return payload.approvedAt ? new Date(payload.approvedAt) : new Date();
}

async function upsertBiddingOnboardingCase(
  tx: Prisma.TransactionClient,
  payload: OnboardingSyncPayload,
  entityId: string
) {
  const partyType = payload.partyType;
  const status = syncStatus(payload);
  const submittedAt = submittedAtFromPayload(payload);

  if (status === "SUBMITTED") {
    await tx.onboardingCase.upsert({
      where: { entityType_entityId: { entityType: partyType, entityId } },
      create: {
        entityType: partyType,
        entityId,
        status: "SUBMITTED",
        remarks: "Bidding",
        submittedAt,
      },
      update: {
        status: "SUBMITTED",
        remarks: "Bidding",
        submittedAt,
        reviewedAt: null,
        reviewedById: null,
      },
    });
    return;
  }

  const reviewedById = payload.actor?.tmsUserId ?? null;
  await tx.onboardingCase.upsert({
    where: { entityType_entityId: { entityType: partyType, entityId } },
    create: {
      entityType: partyType,
      entityId,
      status: "APPROVED",
      reviewedAt: submittedAt,
      reviewedById,
      submittedAt,
    },
    update: {
      status: "APPROVED",
      reviewedAt: submittedAt,
      reviewedById,
    },
  });
}

/** Bidding onboarding handoff — SUBMITTED (queue) or APPROVED (auto-approve). */
export async function upsertPartyFromBiddingOnboardingSync(payload: OnboardingSyncPayload) {
  const existingHandoff = await prisma.biddingIntegrationHandoff.findUnique({
    where: { idempotencyKey: payload.idempotencyKey },
  });
  if (existingHandoff?.tmsPartyId) {
    const onboardingCase = await prisma.onboardingCase.findUnique({
      where: {
        entityType_entityId: {
          entityType: payload.partyType,
          entityId: existingHandoff.tmsPartyId,
        },
      },
    });
    return {
      tmsPartyId: existingHandoff.tmsPartyId,
      partyType: payload.partyType,
      biddingCompanyId: payload.biddingCompanyId,
      created: false,
      onboardingCaseId: onboardingCase?.id ?? null,
    };
  }

  const byApplication =
    payload.partyType === "CLIENT"
      ? await prisma.client.findFirst({
          where: {
            OR: [
              { biddingApplicationId: payload.biddingApplicationId },
              { biddingCompanyId: payload.biddingCompanyId },
            ],
          },
        })
      : await prisma.vendor.findFirst({
          where: {
            OR: [
              { biddingApplicationId: payload.biddingApplicationId },
              { biddingCompanyId: payload.biddingCompanyId },
            ],
          },
        });

  if (byApplication) {
    await prisma.$transaction(async (tx) => {
      await tx.biddingIntegrationHandoff.upsert({
        where: { idempotencyKey: payload.idempotencyKey },
        create: {
          idempotencyKey: payload.idempotencyKey,
          kind: "ONBOARDING",
          tmsPartyId: byApplication.id,
          partyType: payload.partyType,
          payloadHash: hashPayload(payload),
        },
        update: { payloadHash: hashPayload(payload) },
      });
      await upsertBiddingOnboardingCase(tx, payload, byApplication.id);
    });
    const onboardingCase = await prisma.onboardingCase.findUnique({
      where: { entityType_entityId: { entityType: payload.partyType, entityId: byApplication.id } },
    });
    return {
      tmsPartyId: byApplication.id,
      partyType: payload.partyType,
      biddingCompanyId: payload.biddingCompanyId,
      created: false,
      onboardingCaseId: onboardingCase?.id ?? null,
      onboardingStatus: onboardingCase?.status ?? syncStatus(payload),
    };
  }

  const snap = payload.snapshot;
  const biddingRemarks = payload.remarks?.trim() || snap.remarks?.trim() || null;
  const displayName = snap.tradeName?.trim() || snap.legalName?.trim() || "Bidding party";
  const reviewedById = payload.actor?.tmsUserId ?? null;
  const reviewedAt = payload.approvedAt ? new Date(payload.approvedAt) : new Date();

  const partyId = await prisma.$transaction(async (tx) => {
    let id: string;
    if (payload.partyType === "CLIENT") {
      const client = await tx.client.create({
        data: {
          name: displayName,
          legalName: snap.legalName ?? null,
          contactName: snap.contactName ?? null,
          phone: snap.phone ?? null,
          email: snap.email ?? null,
          gstin: snap.gstin ?? null,
          pan: snap.pan ?? null,
          cin: snap.cin ?? null,
          msme: snap.msme ?? null,
          biddingCompanyId: payload.biddingCompanyId,
          biddingApplicationId: payload.biddingApplicationId,
          notes: biddingRemarks,
        },
      });
      id = client.id;
    } else {
      const vendor = await tx.vendor.create({
        data: {
          name: displayName,
          type: snap.vendorType ?? "FLEET_OWNER",
          contactName: snap.contactName ?? null,
          phone: snap.phone ?? null,
          email: snap.email ?? null,
          whatsapp: snap.whatsapp ?? snap.phone ?? null,
          gstin: snap.gstin ?? null,
          pan: snap.pan ?? null,
          msme: snap.msme ?? null,
          biddingCompanyId: payload.biddingCompanyId,
          biddingApplicationId: payload.biddingApplicationId,
          notes: biddingRemarks,
        },
      });
      id = vendor.id;
    }

    await upsertRegisteredAddress(tx, payload.partyType, id, snap.registeredAddress);
    await upsertBankCommercial(tx, payload.partyType, id, snap.bank);
    await upsertBiddingOnboardingCase(tx, payload, id);

    await tx.biddingIntegrationHandoff.create({
      data: {
        idempotencyKey: payload.idempotencyKey,
        kind: "ONBOARDING",
        tmsPartyId: id,
        partyType: payload.partyType,
        payloadHash: hashPayload(payload),
      },
    });

    return id;
  });

  const ownerType = payload.partyType === "CLIENT" ? "client" : "vendor";
  await importSnapshotDocuments(ownerType, partyId, snap.documents);

  await logAudit({
    user: reviewedById ? ({ id: reviewedById } as SessionUser) : undefined,
    action: payload.partyType === "CLIENT" ? "client.create" : "vendor.create",
    entity: payload.partyType === "CLIENT" ? "Client" : "Vendor",
    entityId: partyId,
    meta: { source: "BIDDING_ONBOARDING", biddingCompanyId: payload.biddingCompanyId },
  });

  const onboardingCase = await prisma.onboardingCase.findUnique({
    where: { entityType_entityId: { entityType: payload.partyType, entityId: partyId } },
  });

  return {
    tmsPartyId: partyId,
    partyType: payload.partyType,
    biddingCompanyId: payload.biddingCompanyId,
    created: true,
    onboardingCaseId: onboardingCase?.id ?? null,
    onboardingStatus: onboardingCase?.status ?? syncStatus(payload),
  };
}

/** @deprecated Use upsertPartyFromBiddingOnboardingSync */
export const upsertPartyFromOnboardingApproved = upsertPartyFromBiddingOnboardingSync;

function buildAwardIndentCreate(
  payload: AwardHandoffPayload,
  clientId: string,
  indentNumber: string,
  resolvedCargo: ReturnType<typeof resolveAwardCargo>
): Prisma.IndentCreateInput {
  const from = payload.lane.from;
  const to = payload.lane.to;
  const cargo = payload.cargo;
  const reportingAt = cargo.reportingAt ? new Date(cargo.reportingAt) : undefined;

  return {
    indentNumber,
    client: { connect: { id: clientId } },
    indentDate: new Date(),
    status: "DRAFT",
    source: "BIDDING",
    allocationMode: "MANUAL",
    remarks: payload.remarks ?? null,
    biddingLoadRequirementId: payload.loadRequirementId,
    biddingBidId: payload.bidId,
    biddingBidAcceptanceId: payload.bidAcceptanceId ?? null,
    biddingHandoffKey: payload.idempotencyKey,
    consignment: {
      create: {
        serviceType: "GTA",
        transactionType: "SPOT",
        vehicleTypeCode: resolvedCargo.vehicleTypeCode,
        bodyTypeCode: resolvedCargo.bodyTypeCode,
        vehicleQuantity: 1,
        insuranceType: "NONE",
        cargoTypeCode: resolvedCargo.cargoTypeCode,
        weightValue: cargo.weightValue ?? null,
        weightUnit: resolvedCargo.weightUnit,
        packageCount: cargo.packageCount ?? null,
        pickupAt: reportingAt,
      },
    },
    loading: {
      create: {
        partyName: from.partyName ?? null,
        gstin: from.gstin ?? null,
        contactName: from.contactName ?? null,
        phone: from.phone ?? null,
        addressLine1: from.addressLine1 ?? null,
        city: from.city ?? null,
        state: from.state ?? null,
        pincode: from.pincode ?? null,
      },
    },
    unloading: {
      create: {
        partyName: to.partyName ?? null,
        gstin: to.gstin ?? null,
        contactName: to.contactName ?? null,
        phone: to.phone ?? null,
        addressLine1: to.addressLine1 ?? null,
        city: to.city ?? null,
        state: to.state ?? null,
        pincode: to.pincode ?? null,
      },
    },
    cargo: {
      create: {
        description: cargo.materialDescription ?? null,
      },
    },
    clientFreight: {
      create: {
        clientRate: payload.clientPriceInr,
        freightType: "FOR",
        paymentMode: "TBB",
      },
    },
    lines: {
      create: [
        {
          lineNumber: 1,
          vehicleTypeCode: resolvedCargo.vehicleTypeCode,
          bodyTypeCode: resolvedCargo.bodyTypeCode,
        },
      ],
    },
  };
}

export async function findAwardHandoffResult(payload: AwardHandoffPayload) {
  const handoff = await prisma.biddingIntegrationHandoff.findUnique({
    where: { idempotencyKey: payload.idempotencyKey },
  });
  if (handoff?.indentId) {
    const indent = await prisma.indent.findFirst({
      where: { id: handoff.indentId },
      include: { trips: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (indent) {
      const trip = indent.trips[0] ?? null;
      return {
        idempotencyKey: payload.idempotencyKey,
        indentId: indent.id,
        indentNumber: indent.indentNumber,
        tripId: trip?.id ?? null,
        tripNumber: trip?.lrNumber ?? null,
        status: { indent: indent.status, placement: indent.placementStatus },
        created: false,
      };
    }
  }

  const byLoad = await prisma.indent.findFirst({
    where: { biddingLoadRequirementId: payload.loadRequirementId },
    include: { trips: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (byLoad) {
    const trip = byLoad.trips[0] ?? null;
    return {
      idempotencyKey: payload.idempotencyKey,
      indentId: byLoad.id,
      indentNumber: byLoad.indentNumber,
      tripId: trip?.id ?? null,
      tripNumber: trip?.lrNumber ?? null,
      status: { indent: byLoad.status, placement: byLoad.placementStatus },
      created: false,
    };
  }

  return null;
}

export async function createIndentFromBiddingAward(payload: AwardHandoffPayload) {
  const cached = await findAwardHandoffResult(payload);
  if (cached) return cached;

  const client = await prisma.client.findFirst({
    where: { biddingCompanyId: payload.clientBiddingCompanyId, isActive: true, deletedAt: null },
  });
  if (!client) {
    throw partyNotLinkedError("CLIENT");
  }

  const vendor = await prisma.vendor.findFirst({
    where: { biddingCompanyId: payload.vendorBiddingCompanyId, isActive: true, deletedAt: null },
  });
  if (!vendor) {
    throw partyNotLinkedError("VENDOR");
  }

  const resolvedCargo = resolveAwardCargo(payload.cargo);
  const indentNumber = await nextNumber("IND");

  const { indentId } = await prisma.$transaction(async (tx) => {
    const created = await tx.indent.create({
      data: buildAwardIndentCreate(payload, client.id, indentNumber, resolvedCargo),
    });

    await allocateVendorInTransaction(
      tx,
      created.id,
      { vendorId: vendor.id, vendorRate: payload.vendorPriceInr },
      null
    );

    await tx.biddingIntegrationHandoff.create({
      data: {
        idempotencyKey: payload.idempotencyKey,
        kind: "AWARD",
        indentId: created.id,
        partyType: "INDENT",
        payloadHash: hashPayload(payload),
      },
    });

    return { indentId: created.id };
  });

  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    include: { trips: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!indent) throw new Error("Indent missing after handoff");

  const deadlineAt = new Date(Date.now() + PLACEMENT_DEADLINE_MS);
  const { createImportantEvent } = await import("./important-event.service");
  await createImportantEvent({
    type: "ALLOCATION_PLACEMENT_DEADLINE",
    severity: "INFO",
    title: `Placement timer started for ${indent.indentNumber}`,
    description: "Vehicle must reach within 24 hours.",
    indentId: indent.id,
    dueAt: deadlineAt,
  });

  await logAudit({
    action: "indent.created",
    entity: "INDENT",
    entityId: indent.id,
    meta: {
      source: "BIDDING_AWARD",
      biddingLoadRequirementId: payload.loadRequirementId,
      biddingHandoffKey: payload.idempotencyKey,
    },
  });

  const trip = indent.trips[0] ?? null;
  return {
    idempotencyKey: payload.idempotencyKey,
    indentId: indent.id,
    indentNumber: indent.indentNumber,
    tripId: trip?.id ?? null,
    tripNumber: trip?.lrNumber ?? null,
    status: { indent: indent.status, placement: indent.placementStatus },
    created: true,
  };
}

function mapBiddingVendorRow(
  r: {
    id: string;
    kind: "trip" | "indent";
    indentId: string | null;
    lrNumber: string;
    route: string;
    client: string;
    vendorRate: number | null;
    status: string;
  },
  indentMeta: Map<string, { indentNumber: string; biddingLoadRequirementId: string | null }>,
  tripMeta: Map<
    string,
    {
      status: string;
      indent: { indentNumber: string; biddingLoadRequirementId: string | null } | null;
    }
  >
) {
  if (r.kind === "trip") {
    const meta = tripMeta.get(r.id);
    return {
      tripId: r.id,
      lrNumber: r.lrNumber,
      indentId: r.indentId ?? r.id,
      indentNumber: meta?.indent?.indentNumber ?? null,
      route: r.route,
      clientName: r.client,
      vendorRateInr: r.vendorRate,
      displayStatus: r.status,
      rawTripStatus: meta?.status ?? null,
      biddingLoadRequirementId: meta?.indent?.biddingLoadRequirementId ?? null,
      kind: "trip" as const,
    };
  }
  const indentId = r.indentId ?? r.id;
  const meta = indentMeta.get(indentId);
  return {
    tripId: null,
    lrNumber: r.lrNumber,
    indentId,
    indentNumber: meta?.indentNumber ?? r.lrNumber,
    route: r.route,
    clientName: r.client,
    vendorRateInr: r.vendorRate,
    displayStatus: r.status,
    rawTripStatus: null,
    biddingLoadRequirementId: meta?.biddingLoadRequirementId ?? null,
    kind: "indent" as const,
  };
}

export async function listBiddingVendorTrips(vendorId: string) {
  const baseRows = await getVendorTrips(vendorId);

  const biddingPendingIndents = await prisma.indent.findMany({
    where: {
      vendorId,
      source: "BIDDING",
      status: { notIn: ["CANCELLED", "COMPLETED", "DRAFT"] },
      trips: { none: {} },
    },
    orderBy: { vendorAllocatedAt: "desc" },
    include: {
      client: { select: { name: true } },
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      allocations: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { allocatedAt: "desc" },
        select: { vendorRate: true },
      },
    },
  });

  const existingIndentIds = new Set(baseRows.filter((r) => r.kind === "indent").map((r) => r.indentId));
  const extraIndentRows = biddingPendingIndents
    .filter((i) => !existingIndentIds.has(i.id))
    .map((i) => {
      const vendorRate = i.allocations[0]?.vendorRate;
      return {
        id: i.id,
        kind: "indent" as const,
        indentId: i.id,
        lrNumber: i.indentNumber,
        route: `${i.loading?.city ?? "—"} → ${i.unloading?.city ?? "—"}`,
        client: i.client.name,
        vehicle: "—",
        vendorRate: vendorRate != null ? Number(vendorRate) : null,
        status: resolveVendorDisplayStatus({
          indentStatus: i.status,
          placementStatus: i.placementStatus,
          kind: "indent",
        }),
        href: `/portal/vendor/assignments/${i.id}`,
      };
    });

  const rows = [...extraIndentRows, ...baseRows];

  const indentIds = rows.filter((r) => r.kind === "indent").map((r) => r.indentId);
  const tripIds = rows.filter((r) => r.kind === "trip").map((r) => r.id);

  const [indents, trips] = await Promise.all([
    indentIds.length
      ? prisma.indent.findMany({
          where: { id: { in: indentIds }, source: "BIDDING" },
          select: { id: true, indentNumber: true, biddingLoadRequirementId: true },
        })
      : [],
    tripIds.length
      ? prisma.trip.findMany({
          where: { id: { in: tripIds } },
          select: {
            id: true,
            status: true,
            indent: {
              select: { source: true, biddingLoadRequirementId: true, indentNumber: true },
            },
          },
        })
      : [],
  ]);

  const biddingIndentIds = new Set(indents.map((i) => i.id));
  const biddingTripIds = new Set(
    trips.filter((t) => t.indent?.source === "BIDDING").map((t) => t.id)
  );
  const indentMeta = new Map(indents.map((i) => [i.id, i]));
  const tripMeta = new Map(trips.map((t) => [t.id, t]));

  return rows
    .filter((r) =>
      r.kind === "indent" ? biddingIndentIds.has(r.indentId) : biddingTripIds.has(r.id)
    )
    .map((r) => mapBiddingVendorRow(r, indentMeta, tripMeta));
}

/** Trip list links may use indent id before TMS creates a trip row — resolve to trip id. */
export async function resolveBiddingVendorTripId(
  vendorId: string,
  tripOrIndentId: string,
): Promise<string | null> {
  const direct = await prisma.trip.findFirst({
    where: { id: tripOrIndentId, vendorId },
    select: { id: true },
  });
  if (direct) return direct.id;

  const indent = await prisma.indent.findFirst({
    where: { id: tripOrIndentId, vendorId, source: "BIDDING" },
    select: { id: true },
  });
  if (!indent) return null;

  const { syncTripFromIndent } = await import("../vendor-trip-sync");
  await syncTripFromIndent(indent.id);

  const synced = await prisma.trip.findFirst({
    where: { indentId: indent.id, vendorId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return synced?.id ?? null;
}

export async function getBiddingVendorTripDetail(vendorId: string, tripOrIndentId: string) {
  const tripId = await resolveBiddingVendorTripId(vendorId, tripOrIndentId);
  if (!tripId) return null;

  const detail = await getVendorTripDetail(vendorId, tripId);
  if (!detail) return null;

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, vendorId },
    select: {
      indentId: true,
      indent: { select: { source: true, indentNumber: true, biddingLoadRequirementId: true } },
    },
  });
  if (!trip?.indent || trip.indent.source !== "BIDDING") return null;

  const latestPod = await prisma.indentPod.findFirst({
    where: { tripId },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, status: true },
  });

  const {
    getVendorTripAdvanceRequest,
    isTripAdvanceWindowOpen,
    advanceWindowClosedReason,
  } = await import("./trip-advance.service");
  const { resolveTripPodUploadGate } = await import("../pod-upload-eligibility");

  const advanceRequest = await getVendorTripAdvanceRequest(vendorId, tripId);
  const advanceWindowOpen = await isTripAdvanceWindowOpen(tripId);
  const closedReason = advanceWindowClosedReason(detail.rawStatus);
  const hasLiveRequest = Boolean(
    advanceRequest && !["REJECTED", "CANCELLED"].includes(advanceRequest.status),
  );
  const podUpload = resolveTripPodUploadGate(detail.rawStatus, detail.podState ?? null);

  return {
    ...detail,
    tripId,
    displayStatus: detail.status,
    routeSummary: detail.route,
    clientName: detail.client,
    vendorRateInr: detail.vendorRate,
    indentNumber: trip.indent.indentNumber,
    biddingLoadRequirementId: trip.indent.biddingLoadRequirementId,
    pod: latestPod ? { id: latestPod.id, status: latestPod.status } : null,
    podUpload,
    advance: {
      request: advanceRequest,
      canRequestAdvance: advanceWindowOpen && !hasLiveRequest,
      advanceWindowOpen,
      advanceWindowClosedReason: closedReason,
    },
  };
}

export async function getBiddingVendorPaymentsSummary(vendorId: string) {
  const [outstandingPayableInr, payments] = await Promise.all([
    computeOutstandingVendorPayables(vendorId),
    listVendorPayments({ vendorId }),
  ]);

  const paidLifetimeInr = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.netPayable, 0);

  const recentPayments = payments.slice(0, 20).map((p) => ({
    id: p.id,
    tripId: p.tripId,
    lrNumber: p.trip?.lrNumber ?? null,
    paymentType: p.paymentType,
    netPayableInr: p.netPayable,
    status: p.status,
    paidAt: p.paidAt,
  }));

  return {
    outstandingPayableInr,
    paidLifetimeInr,
    recentPayments,
  };
}
