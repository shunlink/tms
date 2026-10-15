import "server-only";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { withIntegrationProvider } from "../core/resolver";
import { mockFetchEwayBill, mockGenerateEwayBill } from "./providers/mock";
import { surepassFetchEwayBill, surepassGenerateEwayBill } from "./providers/surepass";
import type {
  EwayBillFetchResult,
  EwayBillGenerateInput,
  EwayBillGenerateResult,
  EwayBillMode,
  NormalizedEwayBill,
} from "./types";

export async function fetchEWayBill(ewayBillNumber: string): Promise<EwayBillFetchResult> {
  return withIntegrationProvider(
    () => mockFetchEwayBill(ewayBillNumber),
    () => surepassFetchEwayBill(ewayBillNumber)
  );
}

/** Backend-only generation — not exposed in frontend UI. */
export async function generateEWayBill(input: EwayBillGenerateInput): Promise<EwayBillGenerateResult> {
  return withIntegrationProvider(
    () => mockGenerateEwayBill(input),
    () => surepassGenerateEwayBill(input)
  );
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ewayBillToPrismaData(
  data: Partial<NormalizedEwayBill> & { mode?: EwayBillMode }
) {
  return {
    mode: data.mode ?? "MANUAL",
    ewayBillNumber: data.ewayBillNumber ?? null,
    status: data.status ?? null,
    supplierGstin: data.supplierGstin ?? null,
    recipientGstin: data.recipientGstin ?? null,
    documentType: data.documentType ?? null,
    documentNumber: data.documentNumber ?? null,
    documentDate: parseDate(data.documentDate),
    goodsDescription: data.goodsDescription ?? null,
    hsnCode: data.hsnCode ?? null,
    quantity: data.quantity ?? null,
    value: data.value ?? null,
    origin: data.origin ?? null,
    destination: data.destination ?? null,
    transporterName: data.transporterName ?? null,
    transporterGstin: data.transporterGstin ?? null,
    vehicleNumber: data.vehicleNumber ?? null,
    validFrom: parseDate(data.validFrom),
    validUntil: parseDate(data.validUntil),
    provider: data.provider ?? null,
    fetchedAt: data.fetchedAt ? new Date(data.fetchedAt) : null,
    generatedAt: data.source === "SHUNLINK_GENERATED" ? new Date() : null,
    source: data.source ?? "MANUAL",
  };
}

export async function upsertIndentEwayBill(
  indentId: string,
  data: Partial<NormalizedEwayBill> & { mode: EwayBillMode },
  actor?: SessionUser | null
) {
  const row = await prisma.indentEwayBill.upsert({
    where: { indentId },
    create: { indentId, ...ewayBillToPrismaData(data) },
    update: ewayBillToPrismaData(data),
  });

  await logAudit({
    user: actor,
    action: "integration.ewaybill.saved",
    entity: "INDENT",
    entityId: indentId,
    meta: {
      mode: data.mode,
      ewayBillNumber: data.ewayBillNumber,
      source: data.source,
    },
  });

  return row;
}
