import type { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "../../prisma";
import { paymentProviderId } from "../../payments/config";

export class GatewaySettlementImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewaySettlementImportError";
  }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function amountMinor(raw: string): number | null {
  const n = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export type GatewaySettlementCsvMapping = {
  providerTransferRef: string;
  amount?: string;
  fee?: string;
  net?: string;
};

const DEFAULT_GATEWAY_MAPPING: GatewaySettlementCsvMapping = {
  providerTransferRef: "transfer_ref",
  amount: "amount",
  fee: "fee",
  net: "net",
};

export async function importGatewaySettlementCsv(input: {
  csvText: string;
  providerId?: string;
  fileName?: string;
  mapping?: GatewaySettlementCsvMapping;
  batchReference?: string;
  settlementDate?: Date;
  actorId?: string;
}) {
  const providerId = input.providerId ?? paymentProviderId();
  if (!providerId || providerId === "none") {
    throw new GatewaySettlementImportError(
      "No payment gateway configured — import provider settlement CSV manually when reports are available"
    );
  }

  const mapping = input.mapping ?? DEFAULT_GATEWAY_MAPPING;
  const lines = input.csvText.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new GatewaySettlementImportError("CSV must include header and data rows");

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idxRef = headers.indexOf(mapping.providerTransferRef.toLowerCase());
  const idxAmt = mapping.amount ? headers.indexOf(mapping.amount.toLowerCase()) : -1;
  const idxFee = mapping.fee ? headers.indexOf(mapping.fee.toLowerCase()) : -1;
  const idxNet = mapping.net ? headers.indexOf(mapping.net.toLowerCase()) : -1;
  if (idxRef < 0) throw new GatewaySettlementImportError(`Column not found: ${mapping.providerTransferRef}`);

  const fileSha256 = createHash("sha256").update(input.csvText).digest("hex");

  return prisma.$transaction(async (tx) => {
    const imp = await tx.gatewaySettlementImport.create({
      data: {
        providerId,
        fileName: input.fileName,
        fileSha256,
        batchReference: input.batchReference,
        settlementDate: input.settlementDate,
        importedById: input.actorId,
        rawPayload: { mapping } as Prisma.InputJsonValue,
      },
    });

    let lineNumber = 0;
    let gross = 0;
    let fees = 0;
    let net = 0;

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      if (cells.every((c) => !c.trim())) continue;
      lineNumber++;
      const ref = (cells[idxRef] ?? "").trim();
      if (!ref) continue;

      const rawRow: Record<string, string> = {};
      headers.forEach((h, j) => {
        rawRow[h] = cells[j] ?? "";
      });

      const amt = idxAmt >= 0 ? amountMinor(cells[idxAmt] ?? "") : null;
      const fee = idxFee >= 0 ? amountMinor(cells[idxFee] ?? "") : null;
      const netAmt = idxNet >= 0 ? amountMinor(cells[idxNet] ?? "") : null;
      if (amt) gross += amt;
      if (fee) fees += fee;
      if (netAmt) net += netAmt;

      const payment = await tx.outboundPayment.findFirst({
        where: { providerTransferRef: ref },
        select: { id: true, amountMinor: true, status: true },
      });

      const stableRowKey = `${ref}|${amt ?? 0}|${lineNumber}`;

      const line = await tx.gatewaySettlementLine.create({
        data: {
          importId: imp.id,
          lineNumber,
          providerTransferRef: ref,
          outboundPaymentId: payment?.id,
          amountMinor: amt,
          feeMinor: fee,
          netMinor: netAmt,
          stableRowKey,
          rawRow,
        },
      });

      const internalAmount = payment?.amountMinor ?? null;
      const providerAmount = amt;
      let status = "OPEN";
      let discrepancyType: string | null = null;
      if (!payment) {
        status = "UNMATCHED";
        discrepancyType = "UNKNOWN_PROVIDER_REF";
      } else if (providerAmount != null && providerAmount !== internalAmount) {
        status = "MISMATCH";
        discrepancyType = "AMOUNT_MISMATCH";
      } else if (payment.status !== "SUCCEEDED") {
        status = "MISMATCH";
        discrepancyType = "INTERNAL_STATUS_NOT_SUCCEEDED";
      } else {
        status = "MATCHED";
      }

      await tx.reconciliationRecord.create({
        data: {
          paymentId: payment?.id,
          providerId,
          providerTransferRef: ref,
          internalAmountMinor: internalAmount,
          providerAmountMinor: providerAmount,
          status,
          discrepancyType,
          matchingMethod: status === "MATCHED" ? "SETTLEMENT_BATCH_CSV" : null,
          evidenceJson: {
            gatewaySettlementLineId: line.id,
            importId: imp.id,
            source: "PROVIDER_SETTLEMENT_CSV",
          } as Prisma.InputJsonValue,
          gatewaySettlementLineId: line.id,
          insufficientEvidence: false,
          notes:
            status === "MATCHED"
              ? "Matched from imported provider settlement report"
              : "Settlement line requires review",
        },
      });
    }

    await tx.gatewaySettlementImport.update({
      where: { id: imp.id },
      data: {
        grossAmountMinor: gross || null,
        feesAmountMinor: fees || null,
        netAmountMinor: net || null,
      },
    });

    if (input.actorId) {
      await tx.auditLog.create({
        data: {
          userId: input.actorId,
          action: "GATEWAY_SETTLEMENT_IMPORT",
          entity: "GatewaySettlementImport",
          entityId: imp.id,
          meta: JSON.stringify({ providerId, lineCount: lineNumber }),
        },
      });
    }

    return { importId: imp.id, lineCount: lineNumber };
  });
}
