import { prisma } from "../prisma";
import { putObject } from "../storage";
import { companyProfile } from "../company";
import { nextNumber } from "../sequence";
import { formatINR, formatDate } from "../utils";

export type AdvanceVoucherData = {
  voucherNumber: string;
  requestNumber: string;
  advanceRequestId: string;
  tripId: string;
  tripLrNumber: string;
  indentId: string | null;
  indentNumber: string | null;
  vendorName: string;
  vendorGstin: string | null;
  routeFrom: string;
  routeTo: string;
  freightAmount: number;
  requestedAmount: number;
  negotiatedAmount: number | null;
  approvedAmount: number | null;
  paidAmount: number;
  paymentMethod: string;
  paymentDate: Date;
  utrReference: string;
  bankAccountUsed: string | null;
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

export function buildAdvanceVoucherHtml(data: AdvanceVoucherData) {
  const route = `${data.routeFrom} → ${data.routeTo}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Advance Payment Voucher ${escapeHtml(data.voucherNumber)}</title>
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
      <p class="muted">${escapeHtml(companyProfile.phone)} · ${escapeHtml(companyProfile.email)}</p>
    </div>
    <div style="text-align:right">
      <h2>ADVANCE PAYMENT VOUCHER</h2>
      <p class="muted">Voucher No: <strong>${escapeHtml(data.voucherNumber)}</strong></p>
      <p class="muted">Advance ID: ${escapeHtml(data.requestNumber)}</p>
      <p class="muted">Date: ${escapeHtml(formatDate(data.processedAt))}</p>
      <p class="paid">Status: ${escapeHtml(data.status)}</p>
    </div>
  </div>

  <div class="grid">
    <div><div class="label">Vendor / Transporter</div><div class="value">${escapeHtml(data.vendorName)}</div>${data.vendorGstin ? `<div class="muted">GSTIN: ${escapeHtml(data.vendorGstin)}</div>` : ""}</div>
    <div><div class="label">Trip (LR)</div><div class="value">${escapeHtml(data.tripLrNumber)}</div><div class="muted">Trip ID: ${escapeHtml(data.tripId)}</div></div>
    <div><div class="label">Indent</div><div class="value">${escapeHtml(data.indentNumber ?? "—")}</div>${data.indentId ? `<div class="muted">Indent ID: ${escapeHtml(data.indentId)}</div>` : ""}</div>
    <div><div class="label">Route</div><div class="value">${escapeHtml(route)}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Freight amount</td><td style="text-align:right">${escapeHtml(formatINR(data.freightAmount))}</td></tr>
      <tr><td>Advance requested</td><td style="text-align:right">${escapeHtml(formatINR(data.requestedAmount))}</td></tr>
      ${data.negotiatedAmount != null ? `<tr><td>Negotiated advance</td><td style="text-align:right">${escapeHtml(formatINR(data.negotiatedAmount))}</td></tr>` : ""}
      ${data.approvedAmount != null ? `<tr><td>Approved advance</td><td style="text-align:right">${escapeHtml(formatINR(data.approvedAmount))}</td></tr>` : ""}
      <tr><td><strong>Amount actually paid</strong></td><td style="text-align:right"><strong>${escapeHtml(formatINR(data.paidAmount))}</strong></td></tr>
    </tbody>
  </table>

  <div class="grid" style="margin-top:24px">
    <div><div class="label">Payment Method</div><div class="value">${escapeHtml(data.paymentMethod)}</div></div>
    <div><div class="label">Payment Date</div><div class="value">${escapeHtml(formatDate(data.paymentDate))}</div></div>
    <div><div class="label">UTR / Reference</div><div class="value">${escapeHtml(data.utrReference)}</div></div>
    <div><div class="label">Bank / Account Used</div><div class="value">${escapeHtml(data.bankAccountUsed ?? "—")}</div></div>
    <div><div class="label">Processed By</div><div class="value">${escapeHtml(data.processedByName ?? "Finance Team")}</div></div>
    <div><div class="label">Processed At</div><div class="value">${escapeHtml(formatDate(data.processedAt))}</div></div>
  </div>

  <div class="footer">
    This is a system-generated advance payment voucher from ${escapeHtml(companyProfile.name)}.
    Please retain this document for your records.
  </div>
</body>
</html>`;
}

export async function generateAndStoreAdvanceVoucher(
  advanceRequestId: string,
  actorName?: string | null
) {
  const req = await prisma.advanceRequest.findFirst({
    where: { id: advanceRequestId },
    include: {
      trip: {
        select: {
          id: true,
          lrNumber: true,
          routeFrom: true,
          routeTo: true,
          vendorRate: true,
          indentId: true,
          indent: { select: { indentNumber: true } },
        },
      },
      vendor: { select: { name: true, gstin: true } },
      processedBy: { select: { name: true } },
    },
  });
  if (!req) throw new Error("Advance request not found");
  if (!req.paidAmount || !req.paymentMethod || !req.paymentDate || !req.utrReference) {
    throw new Error("Payment details are incomplete — cannot generate voucher");
  }

  const voucherNumber = req.voucherNumber ?? (await nextNumber("APV"));
  const n = (v: { toNumber(): number } | number | null | undefined) =>
    v == null ? 0 : typeof v === "number" ? v : v.toNumber();

  const voucherData: AdvanceVoucherData = {
    voucherNumber,
    requestNumber: req.requestNumber,
    advanceRequestId: req.id,
    tripId: req.tripId,
    tripLrNumber: req.trip.lrNumber,
    indentId: req.trip.indentId,
    indentNumber: req.trip.indent?.indentNumber ?? null,
    vendorName: req.vendor.name,
    vendorGstin: req.vendor.gstin,
    routeFrom: req.trip.routeFrom,
    routeTo: req.trip.routeTo,
    freightAmount: n(req.trip.vendorRate),
    requestedAmount: n(req.requestedAmount),
    negotiatedAmount: req.negotiatedAmount != null ? n(req.negotiatedAmount) : null,
    approvedAmount: req.approvedAmount != null ? n(req.approvedAmount) : null,
    paidAmount: n(req.paidAmount),
    paymentMethod: req.paymentMethod,
    paymentDate: req.paymentDate,
    utrReference: req.utrReference,
    bankAccountUsed: req.bankAccountUsed,
    processedByName: actorName ?? req.processedBy?.name ?? null,
    processedAt: req.processedAt ?? new Date(),
    status: "PAID",
  };

  const html = buildAdvanceVoucherHtml(voucherData);
  const key = `advance-voucher/${advanceRequestId}/${voucherNumber}.html`;
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
      entityType: "ADVANCE_REQUEST",
      entityId: advanceRequestId,
      documentType: "ADVANCE_VOUCHER",
      title: `Advance Voucher ${voucherNumber}`,
    },
  });

  await prisma.advanceRequest.update({
    where: { id: advanceRequestId },
    data: {
      voucherNumber,
      voucherFileId: stored.id,
      voucherGeneratedAt: new Date(),
    },
  });

  return { voucherNumber, voucherUrl: url, voucherFileId: stored.id, voucherData };
}

export async function getAdvanceVoucherForRequest(advanceRequestId: string) {
  const req = await prisma.advanceRequest.findFirst({
    where: { id: advanceRequestId },
    include: {
      voucherFile: true,
      paymentProofFile: true,
      trip: {
        select: {
          id: true,
          lrNumber: true,
          routeFrom: true,
          routeTo: true,
          vendorRate: true,
          indentId: true,
          indent: { select: { indentNumber: true } },
        },
      },
      vendor: { select: { name: true, gstin: true } },
      processedBy: { select: { name: true } },
    },
  });
  if (!req) return null;

  const n = (v: { toNumber(): number } | number | null | undefined) =>
    v == null ? 0 : typeof v === "number" ? v : v.toNumber();

  const voucherData: AdvanceVoucherData | null =
    req.voucherNumber && req.paidAmount && req.paymentMethod && req.paymentDate && req.utrReference
      ? {
          voucherNumber: req.voucherNumber,
          requestNumber: req.requestNumber,
          advanceRequestId: req.id,
          tripId: req.tripId,
          tripLrNumber: req.trip.lrNumber,
          indentId: req.trip.indentId,
          indentNumber: req.trip.indent?.indentNumber ?? null,
          vendorName: req.vendor.name,
          vendorGstin: req.vendor.gstin,
          routeFrom: req.trip.routeFrom,
          routeTo: req.trip.routeTo,
          freightAmount: n(req.trip.vendorRate),
          requestedAmount: n(req.requestedAmount),
          negotiatedAmount: req.negotiatedAmount != null ? n(req.negotiatedAmount) : null,
          approvedAmount: req.approvedAmount != null ? n(req.approvedAmount) : null,
          paidAmount: n(req.paidAmount),
          paymentMethod: req.paymentMethod,
          paymentDate: req.paymentDate,
          utrReference: req.utrReference,
          bankAccountUsed: req.bankAccountUsed,
          processedByName: req.processedBy?.name ?? null,
          processedAt: req.processedAt ?? new Date(),
          status: "PAID",
        }
      : null;

  return {
    voucherData,
    voucherUrl: req.voucherFile?.url ?? null,
    paymentProofUrl: req.paymentProofFile?.url ?? null,
    paymentProofFileName: req.paymentProofFile?.fileName ?? null,
  };
}
