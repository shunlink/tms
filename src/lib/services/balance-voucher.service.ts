import { prisma } from "../prisma";
import { putObject } from "../storage";
import { companyProfile } from "../company";
import { nextNumber } from "../sequence";
import { formatINR, formatDate } from "../utils";

export type BalanceVoucherData = {
  voucherNumber: string;
  taskId: string;
  tripId: string;
  tripLrNumber: string;
  indentNumber: string | null;
  vendorName: string;
  vendorGstin: string | null;
  routeFrom: string;
  routeTo: string;
  freightAmount: number;
  additionalChargesAmount: number;
  deductionsAmount: number;
  finalPayableAmount: number;
  advanceAmount: number;
  balancePaid: number;
  paymentMethod: string;
  paymentDate: Date;
  utrReference: string | null;
  chequeNumber: string | null;
  processedByName: string | null;
  processedAt: Date;
  status: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function n(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

export function buildBalanceVoucherHtml(data: BalanceVoucherData) {
  const route = `${data.routeFrom} → ${data.routeTo}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Vendor Payment Voucher ${escapeHtml(data.voucherNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 0; font-size: 26px; color: #1d4ed8; }
    .muted { color: #64748b; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; margin-bottom: 24px; }
    .label { font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .value { font-size: 14px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 13px; }
    th { background: #f8fafc; }
    .paid { color: #15803d; font-weight: 700; font-size: 18px; }
    .footer { margin-top: 32px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(companyProfile.name)}</h1>
      <p class="muted">${escapeHtml(companyProfile.address)}</p>
      <p class="muted">GSTIN: ${escapeHtml(companyProfile.gstin)} · PAN: ${escapeHtml(companyProfile.pan)}</p>
    </div>
    <div style="text-align:right">
      <h2>VENDOR PAYMENT VOUCHER</h2>
      <p class="muted">Voucher No: <strong>${escapeHtml(data.voucherNumber)}</strong></p>
      <p class="muted">Date: ${escapeHtml(formatDate(data.processedAt))}</p>
      <p class="paid">Status: ${escapeHtml(data.status)}</p>
    </div>
  </div>

  <div class="grid">
    <div><div class="label">Vendor / Transporter</div><div class="value">${escapeHtml(data.vendorName)}</div>${data.vendorGstin ? `<div class="muted">GSTIN: ${escapeHtml(data.vendorGstin)}</div>` : ""}</div>
    <div><div class="label">Trip (LR)</div><div class="value">${escapeHtml(data.tripLrNumber)}</div></div>
    <div><div class="label">Indent</div><div class="value">${escapeHtml(data.indentNumber ?? "—")}</div></div>
    <div><div class="label">Route</div><div class="value">${escapeHtml(route)}</div></div>
  </div>

  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount (INR)</th></tr></thead>
    <tbody>
      <tr><td>Agreed freight</td><td style="text-align:right">${escapeHtml(formatINR(data.freightAmount))}</td></tr>
      ${data.additionalChargesAmount > 0 ? `<tr><td>Additional charges (detention etc.)</td><td style="text-align:right">+ ${escapeHtml(formatINR(data.additionalChargesAmount))}</td></tr>` : ""}
      ${data.deductionsAmount > 0 ? `<tr><td>Deductions</td><td style="text-align:right">- ${escapeHtml(formatINR(data.deductionsAmount))}</td></tr>` : ""}
      <tr><td><strong>Final payable</strong></td><td style="text-align:right"><strong>${escapeHtml(formatINR(data.finalPayableAmount))}</strong></td></tr>
      <tr><td>Advance already paid</td><td style="text-align:right">- ${escapeHtml(formatINR(data.advanceAmount))}</td></tr>
      <tr><td><strong>Balance paid</strong></td><td style="text-align:right"><strong>${escapeHtml(formatINR(data.balancePaid))}</strong></td></tr>
    </tbody>
  </table>

  <div class="grid" style="margin-top:24px">
    <div><div class="label">Payment Method</div><div class="value">${escapeHtml(data.paymentMethod)}</div></div>
    <div><div class="label">Payment Date</div><div class="value">${escapeHtml(formatDate(data.paymentDate))}</div></div>
    <div><div class="label">UTR / Reference</div><div class="value">${escapeHtml(data.utrReference ?? "—")}</div></div>
    ${data.chequeNumber ? `<div><div class="label">Cheque Number</div><div class="value">${escapeHtml(data.chequeNumber)}</div></div>` : ""}
    <div><div class="label">Processed By</div><div class="value">${escapeHtml(data.processedByName ?? "Finance Team")}</div></div>
  </div>

  <div class="footer">
    This is a system-generated vendor payment advice from ${escapeHtml(companyProfile.name)}.
    Please retain this document for your records.
  </div>
</body>
</html>`;
}

export async function generateAndStoreBalanceVoucher(
  taskId: string,
  payment: {
    amount: number;
    paidAt: Date;
    paymentMode: string;
    utrReference?: string | null;
    chequeNumber?: string | null;
  },
  actorName?: string | null
) {
  const task = await prisma.vendorBalancePaymentTask.findFirst({
    where: { id: taskId },
    include: {
      trip: {
        select: {
          id: true,
          lrNumber: true,
          routeFrom: true,
          routeTo: true,
        },
      },
      vendor: { select: { name: true, gstin: true } },
      indent: { select: { indentNumber: true } },
      processedBy: { select: { name: true } },
    },
  });
  if (!task) throw new Error("Balance payment task not found");

  const voucherNumber = task.voucherNumber ?? (await nextNumber("BPV"));
  const voucherData: BalanceVoucherData = {
    voucherNumber,
    taskId: task.id,
    tripId: task.tripId,
    tripLrNumber: task.trip.lrNumber,
    indentNumber: task.indent?.indentNumber ?? null,
    vendorName: task.vendor.name,
    vendorGstin: task.vendor.gstin,
    routeFrom: task.trip.routeFrom,
    routeTo: task.trip.routeTo,
    freightAmount: n(task.freightAmount),
    additionalChargesAmount: n(task.additionalChargesAmount),
    deductionsAmount: n(task.deductionsAmount),
    finalPayableAmount: n(task.finalPayableAmount),
    advanceAmount: n(task.advanceAmount),
    balancePaid: payment.amount,
    paymentMethod: payment.paymentMode,
    paymentDate: payment.paidAt,
    utrReference: payment.utrReference ?? null,
    chequeNumber: payment.chequeNumber ?? null,
    processedByName: actorName ?? task.processedBy?.name ?? null,
    processedAt: task.processedAt ?? new Date(),
    status: n(task.paidAmount) >= n(task.balanceAmount) ? "PAID" : "PARTIALLY_PAID",
  };

  const html = buildBalanceVoucherHtml(voucherData);
  const key = `balance-voucher/${taskId}/${voucherNumber}.html`;
  const { url } = await putObject(key, Buffer.from(html, "utf-8"));

  const stored = await prisma.storedFile.create({
    data: {
      fileName: `${voucherNumber}.html`,
      mimeType: "text/html",
      sizeBytes: Buffer.byteLength(html, "utf-8"),
      storageKey: key,
      url,
    },
  });

  await prisma.documentAttachment.create({
    data: {
      fileId: stored.id,
      entityType: "VENDOR_BALANCE_PAYMENT",
      entityId: taskId,
      documentType: "BALANCE_VOUCHER",
      title: `Balance Voucher ${voucherNumber}`,
    },
  });

  await prisma.vendorBalancePaymentTask.update({
    where: { id: taskId },
    data: { voucherNumber, voucherFileId: stored.id },
  });

  return { voucherNumber, voucherUrl: url, voucherFileId: stored.id, voucherData };
}

export async function getBalanceVoucherForTask(taskId: string) {
  const task = await prisma.vendorBalancePaymentTask.findFirst({
    where: { id: taskId },
    include: { voucherFile: true, trip: { select: { lrNumber: true } } },
  });
  if (!task?.voucherFile) return null;
  return {
    voucherNumber: task.voucherNumber,
    url: task.voucherFile.url,
    fileName: task.voucherFile.fileName,
    lrNumber: task.trip.lrNumber,
  };
}
