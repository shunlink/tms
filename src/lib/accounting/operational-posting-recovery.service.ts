import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { isSourcePosted } from "./posting.service";
import {
  postClientInvoiceAccrualJournal,
  postClientPaymentReceiptJournal,
  postVendorPaymentCashJournal,
  postVendorTripPayableAccrualJournal,
} from "./operational-posting.service";
import {
  detectStaleVendorPayableAccrual,
  type OperationalPostingGap,
  type OperationalPostingKind,
  type StaleAccrualFinding,
} from "./operational-posting-recovery";

const POSTED = "POSTED";

export async function findOperationalPostingGaps(limit = 100): Promise<OperationalPostingGap[]> {
  const gaps: OperationalPostingGap[] = [];

  const vendorPayments = await prisma.vendorPayment.findMany({
    where: { status: "PAID" },
    orderBy: { paidAt: "desc" },
    take: limit,
    select: { id: true, referenceNo: true, sourceId: true },
  });
  for (const vp of vendorPayments) {
    const posted = await isSourcePosted("VENDOR_PAYMENT", vp.id);
    if (!posted) {
      gaps.push({
        kind: "VENDOR_PAYMENT",
        sourceId: vp.id,
        reference: vp.referenceNo ?? vp.sourceId ?? vp.id,
        detail: "PAID vendor payment without POSTED journal",
      });
    }
  }

  const clientPayments = await prisma.clientPayment.findMany({
    orderBy: { paidAt: "desc" },
    take: limit,
    select: { id: true, referenceNo: true },
  });
  for (const cp of clientPayments) {
    const posted = await isSourcePosted("CLIENT_PAYMENT", cp.id);
    if (!posted) {
      gaps.push({
        kind: "CLIENT_PAYMENT",
        sourceId: cp.id,
        reference: cp.referenceNo ?? cp.id,
        detail: "Client payment without POSTED receipt journal",
      });
    }
  }

  const payables = await prisma.vendorTripPayable.findMany({
    where: { commercialApprovalStatus: "APPROVED" },
    take: limit,
    select: { id: true, tripId: true },
  });
  for (const p of payables) {
    const posted = await isSourcePosted("VENDOR_TRIP_PAYABLE_ACCRUAL", p.id);
    if (!posted) {
      gaps.push({
        kind: "VENDOR_TRIP_PAYABLE_ACCRUAL",
        sourceId: p.tripId,
        reference: p.tripId,
        detail: `Approved payable ${p.id} without accrual journal`,
      });
    }
  }

  const invoices = await prisma.clientInvoice.findMany({
    where: {
      finalizedAt: { not: null },
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    orderBy: { finalizedAt: "desc" },
    take: limit,
    select: { id: true, invoiceNumber: true },
  });
  for (const inv of invoices) {
    const posted = await isSourcePosted("CLIENT_INVOICE_ACCRUAL", inv.id);
    if (!posted) {
      gaps.push({
        kind: "CLIENT_INVOICE_ACCRUAL",
        sourceId: inv.id,
        reference: inv.invoiceNumber,
        detail: "Finalized invoice without accrual journal",
      });
    }
  }

  return gaps;
}

export async function retryOperationalPosting(
  kind: OperationalPostingKind,
  sourceId: string,
  actorId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (kind) {
      case "VENDOR_PAYMENT":
        await postVendorPaymentCashJournal(sourceId, actorId, { skipIfGatewayPosted: true });
        break;
      case "CLIENT_PAYMENT":
        await postClientPaymentReceiptJournal(sourceId, actorId);
        break;
      case "VENDOR_TRIP_PAYABLE_ACCRUAL":
        await postVendorTripPayableAccrualJournal(sourceId, actorId);
        break;
      case "CLIENT_INVOICE_ACCRUAL":
        await postClientInvoiceAccrualJournal(sourceId, actorId);
        break;
      default:
        return { ok: false, error: `Unknown kind ${kind}` };
    }
    let verifySourceType = kind;
    let verifySourceId = sourceId;
    if (kind === "VENDOR_TRIP_PAYABLE_ACCRUAL") {
      verifySourceType = "VENDOR_TRIP_PAYABLE_ACCRUAL";
      const payable = await prisma.vendorTripPayable.findUnique({
        where: { tripId: sourceId },
        select: { id: true },
      });
      verifySourceId = payable?.id ?? sourceId;
    }
    const posted = await isSourcePosted(verifySourceType, verifySourceId);
    if (!posted) return { ok: false, error: "Journal still missing after retry" };
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retry failed";
    await logAudit({
      action: "OPERATIONAL_JOURNAL_RETRY_FAILED",
      entity: kind,
      entityId: sourceId,
      meta: { error: message },
    });
    return { ok: false, error: message };
  }
}

export async function retryAllOperationalPostingGaps(
  limit = 50,
  actorId?: string | null
): Promise<{ attempted: number; succeeded: number; failures: { gap: OperationalPostingGap; error: string }[] }> {
  const gaps = await findOperationalPostingGaps(limit);
  let succeeded = 0;
  const failures: { gap: OperationalPostingGap; error: string }[] = [];
  for (const gap of gaps) {
    const result = await retryOperationalPosting(gap.kind, gap.sourceId, actorId);
    if (result.ok) succeeded++;
    else failures.push({ gap, error: result.error ?? "unknown" });
  }
  return { attempted: gaps.length, succeeded, failures };
}

export async function findStaleVendorPayableAccruals(limit = 100): Promise<StaleAccrualFinding[]> {
  const payables = await prisma.vendorTripPayable.findMany({
    where: { commercialApprovalStatus: "APPROVED" },
    take: limit,
  });
  const findings: StaleAccrualFinding[] = [];
  for (const p of payables) {
    const journal = await prisma.journalEntry.findFirst({
      where: {
        sourceType: "VENDOR_TRIP_PAYABLE_ACCRUAL",
        sourceId: p.id,
        status: POSTED,
      },
      include: { lines: { include: { account: { select: { code: true } } } } },
    });
    if (!journal) continue;
    const stale = detectStaleVendorPayableAccrual({
      payable: p,
      postedLines: journal.lines.map((l) => ({
        accountCode: l.account.code,
        debitMinor: l.debitMinor,
        creditMinor: l.creditMinor,
      })),
    });
    if (stale) findings.push(stale);
  }
  return findings;
}
