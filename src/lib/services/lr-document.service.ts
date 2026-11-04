import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../prisma";
import { putObject, removeObject } from "../storage";
import { getCompanyProfile, type CompanyProfile } from "../company";
import { formatINR, formatDate } from "../utils";
import { renderHtmlToPdf } from "../pdf/render-html-to-pdf";
import { buildTripLrOpenUrl, qrCodePngDataUrl } from "../document-qr";
import type { SessionUser } from "../auth";
import { logAudit } from "../audit";

/** Two copies per A4 page (BuckleTrack-style). */
const LR_PAGES: readonly [string, string][] = [
  ["Shipper Copy", "Consignee Copy"],
  ["Driver Copy", "Accounts Copy"],
];

const LR_NAVY = "#1a3c6e";

export type TripLrSnapshot = {
  tripId: string;
  lrNumber: string;
  lrDate: Date;
  indentNumber: string | null;
  requirementNumber: string | null;
  lineNumber: number | null;
  clientName: string;
  routeFrom: string;
  routeTo: string;
  consignorName: string;
  consignorAddress: string;
  consignorGstin: string;
  consignorContact: string;
  consignorPhone: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeGstin: string;
  consigneeContact: string;
  consigneePhone: string;
  cargoDescription: string;
  hsnCode: string;
  packageCount: string;
  weightText: string;
  invoiceNumber: string;
  invoiceValue: string;
  freightType: string;
  paymentMode: string;
  clientRate: number;
  ewayBillNumber: string;
  ewayValidUntil: string;
  vehicleReg: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
  driverDl: string;
  vendorName: string;
  vendorGstin: string;
  /** Optional admin text from indent → LR E-Way Comments row only. */
  lrComments: string;
  insuranceRisk: string;
  customerCode: string;
};

export type TripLrPdfResult = {
  ok: boolean;
  url?: string;
  generatedAt?: Date;
  error?: string;
  fileId?: string;
};

function n(v: { toNumber(): number } | number | null | undefined) {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dash(v: string | null | undefined) {
  const t = v?.trim();
  return t ? t : "—";
}

function formatPartyAddress(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}) {
  return [
    parts.addressLine1,
    parts.addressLine2,
    parts.city,
    parts.state,
    parts.pincode,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

export async function loadTripLrSnapshot(tripId: string): Promise<TripLrSnapshot | null> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    include: {
      client: { select: { name: true } },
      vendor: { select: { name: true, gstin: true } },
      vehicle: { select: { registrationNumber: true, vehicleTypeCode: true } },
      driver: { select: { name: true, phone: true, dlNumber: true } },
      indentLine: { select: { lineNumber: true } },
      indent: {
        include: {
          requirement: { select: { reqNumber: true } },
          loading: true,
          unloading: true,
          cargo: true,
          consignment: true,
          clientFreight: true,
          ewayBill: true,
        },
      },
    },
  });
  if (!trip) return null;

  const loading = trip.indent?.loading;
  const unloading = trip.indent?.unloading;
  const cargo = trip.indent?.cargo;
  const consignment = trip.indent?.consignment;
  const freight = trip.indent?.clientFreight;
  const eway = trip.indent?.ewayBill;

  const weightVal = trip.loadingWeight ?? consignment?.weightValue;
  const weightUnit = consignment?.weightUnit ?? "MT";
  const weightText =
    weightVal != null ? `${n(weightVal)} ${weightUnit}` : "—";

  return {
    tripId: trip.id,
    lrNumber: trip.lrNumber,
    lrDate: trip.dispatchedAt ?? trip.createdAt,
    indentNumber: trip.indent?.indentNumber ?? null,
    requirementNumber: trip.indent?.requirement?.reqNumber ?? null,
    lineNumber: trip.indentLine?.lineNumber ?? null,
    clientName: trip.client.name,
    routeFrom: trip.routeFrom,
    routeTo: trip.routeTo,
    consignorName: dash(loading?.partyName),
    consignorAddress: formatPartyAddress(loading ?? {}) || trip.routeFrom,
    consignorGstin: dash(loading?.gstin),
    consignorContact: dash(loading?.contactName),
    consignorPhone: dash(loading?.phone),
    consigneeName: dash(unloading?.partyName),
    consigneeAddress: formatPartyAddress(unloading ?? {}) || trip.routeTo,
    consigneeGstin: dash(unloading?.gstin),
    consigneeContact: dash(unloading?.contactName),
    consigneePhone: dash(unloading?.phone),
    cargoDescription: dash(trip.cargoSummary ?? cargo?.description ?? consignment?.cargoTypeCode),
    hsnCode: dash(cargo?.hsnCode),
    packageCount: consignment?.packageCount != null ? String(consignment.packageCount) : "—",
    weightText,
    invoiceNumber: dash(cargo?.invoiceNumber),
    invoiceValue: cargo?.invoiceValue != null ? formatINR(n(cargo.invoiceValue)) : "—",
    freightType: dash(freight?.freightType),
    paymentMode: dash(freight?.paymentMode),
    clientRate: n(trip.clientRate),
    ewayBillNumber: dash(eway?.ewayBillNumber),
    ewayValidUntil: eway?.validUntil ? formatDate(eway.validUntil) : "—",
    vehicleReg: trip.vehicle.registrationNumber,
    vehicleType: trip.vehicle.vehicleTypeCode.replace(/_/g, " "),
    driverName: dash(trip.driver?.name),
    driverPhone: dash(trip.driver?.phone),
    driverDl: dash(trip.driver?.dlNumber),
    vendorName: trip.vendor.name,
    vendorGstin: dash(trip.vendor.gstin),
    lrComments: trip.indent?.remarks?.trim() ?? "",
    insuranceRisk:
      consignment?.insuranceType?.replace(/_/g, " ")?.trim() || "Owner's Risk",
    customerCode: dash(trip.indent?.indentNumber ?? trip.client.name.slice(0, 12)),
  };
}

function formatLrBookingDate(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function loadBrandLogoDataUrl(logoPath?: string): string {
  try {
    const rel = logoPath ?? "brand/logo-light.svg";
    const svg = readFileSync(join(process.cwd(), "public", rel), "utf8");
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return "";
  }
}

function renderBtLrCopy(
  copyLabel: string,
  data: TripLrSnapshot,
  company: CompanyProfile,
  logoDataUrl: string,
  qrDataUrl: string
) {
  const logoImg = logoDataUrl
    ? `<img class="logo" src="${logoDataUrl}" alt="Shunlink" />`
    : `<div class="logo-text">Shunlink</div>`;
  const qrImg = qrDataUrl
    ? `<img class="doc-qr" src="${qrDataUrl}" alt="Open LR online" />`
    : "";
  const lrCommentsCell = data.lrComments ? escapeHtml(data.lrComments) : "";
  const shipperBarName = data.vendorName !== "—" ? data.vendorName : data.consignorName;
  const driverDisplay = data.driverName !== "—" ? data.driverName : "NA";

  return `
  <section class="lr-copy">
    <header class="lr-head">
      <div class="lr-head-left">
        <div class="lr-doc-type">Lorry Receipt – Non-Negotiable</div>
        <div class="lr-co-name">${escapeHtml(company.name)}</div>
        <div class="lr-co-line">${escapeHtml(company.address)}</div>
        <div class="lr-co-line">PAN: ${escapeHtml(company.pan)} | GST: ${escapeHtml(company.gstin)}</div>
      </div>
      <div class="lr-head-right">${logoImg}</div>
    </header>

    <table class="lr-ship-row">
      <tr>
        <td class="lr-bar3-cell">
          <table class="lr-bar3">
            <colgroup>
              <col class="c-ship" />
              <col class="c-lr" />
              <col class="c-date" />
            </colgroup>
            <tr>
              <th>SHIPPER</th>
              <th>LR NUMBER</th>
              <th>BOOKING DATE</th>
            </tr>
            <tr>
              <td>${escapeHtml(shipperBarName)}</td>
              <td class="strong">${escapeHtml(data.lrNumber)}</td>
              <td>${escapeHtml(formatLrBookingDate(data.lrDate))}</td>
            </tr>
          </table>
        </td>
        <td class="copy-cell">
          <div class="copy-badge">${escapeHtml(copyLabel)}</div>
        </td>
      </tr>
    </table>

    <table class="lr-party-grid">
      <colgroup>
        <col class="c-party" />
        <col class="c-party" />
        <col class="c-meta" />
      </colgroup>
      <tr class="lr-party-hdr">
        <th>CONSIGNOR</th>
        <th>CONSIGNEE</th>
        <th class="meta-hdr">CUSTOMER Code : ${escapeHtml(data.customerCode)}</th>
      </tr>
      <tr class="lr-party-body">
        <td class="party-cell">
          <div class="party-name">${escapeHtml(data.consignorName)}</div>
          <div class="party-addr">${escapeHtml(data.consignorAddress)}</div>
          <div class="party-meta-row"><span>GST:</span> ${escapeHtml(data.consignorGstin)}</div>
          <div class="party-meta-row party-mobile"><span>MOBILE NO.</span> ${escapeHtml(data.consignorPhone)}</div>
        </td>
        <td class="party-cell">
          <div class="party-name">${escapeHtml(data.consigneeName)}</div>
          <div class="party-addr">${escapeHtml(data.consigneeAddress)}</div>
          <div class="party-meta-row"><span>GST:</span> ${escapeHtml(data.consigneeGstin)}</div>
          <div class="party-meta-row party-mobile"><span>MOBILE NO.</span> ${escapeHtml(data.consigneePhone)}</div>
        </td>
        <td class="meta-cell">
          <table class="meta-layout">
            <tr>
              <td class="meta-kv-cell">
                <table class="lr-meta-kv">
                  <colgroup>
                    <col class="meta-lbl-col" />
                    <col class="meta-val-col" />
                  </colgroup>
                  <tr><td class="lbl">Vehicle</td><td class="val">${escapeHtml(data.vehicleReg)}</td></tr>
                  <tr><td class="lbl">Vehicle Type</td><td class="val">${escapeHtml(data.vehicleType)}</td></tr>
                  <tr><td class="lbl">Driver Name</td><td class="val">${escapeHtml(driverDisplay)}</td></tr>
                  <tr><td class="lbl">Driver Mobile</td><td class="val">${escapeHtml(data.driverPhone)}</td></tr>
                </table>
              </td>
              ${qrImg ? `<td class="lr-qr-wrap">${qrImg}</td>` : ""}
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div class="goods-desc"><span class="lbl">GOODS DESC:</span> ${escapeHtml(data.cargoDescription)}</div>

    <table class="lr-goods">
      <tr>
        <th>SHIPPER INVOICE NOS,</th>
        <th>DECLARED VALUE</th>
        <th># PACKAGES</th>
        <th>GROSS WT</th>
        <th>CHARGEABLE WEIGHT</th>
        <th>INSURANCE</th>
      </tr>
      <tr>
        <td>${escapeHtml(data.invoiceNumber)}</td>
        <td>${escapeHtml(data.invoiceValue)}</td>
        <td>${escapeHtml(data.packageCount)}</td>
        <td>${escapeHtml(data.weightText)}</td>
        <td>${escapeHtml(data.weightText)}</td>
        <td>${escapeHtml(data.insuranceRisk.replace(/owner'?s risk/i, "Owners Risk"))}</td>
      </tr>
    </table>

    <table class="lr-eway">
      <tr>
        <th>E-WayBill No</th>
        <th>Valid Till</th>
        <th>Comments</th>
      </tr>
      <tr>
        <td>${escapeHtml(data.ewayBillNumber)}</td>
        <td>${escapeHtml(data.ewayValidUntil)}</td>
        <td>${lrCommentsCell}</td>
      </tr>
    </table>

    <div class="lr-decl">
      <div class="decl-box">
        <div class="decl-title">ACKNOWLEDGEMENT</div>
        <p>I have received the goods under this lorry receipt in Good condition, ready for transportation.</p>
        <p class="decl-note">This is a computer generated LR and needs no signature</p>
      </div>
      <div class="decl-box">
        <div class="decl-title">SHIPPER DECLARATION</div>
        <p>I/We do hereby certify that the above particulars of goods consigned by me/us are correct and have been correctly entered into and the consignment is booked with full knowledge of the terms and conditions of this lorry receipt, which I/We accept.</p>
        <div class="decl-sign">Name and Signature of the Shipper</div>
      </div>
    </div>

    <div class="pod-wrap">
      <div class="pod-title">PROOF OF DELIVERY</div>
      <div class="pod-body">
        <div class="pod-line"><span>DATE:</span> ____________________</div>
        <div class="pod-line"><span>TIME:</span> ____________________</div>
        <p class="pod-note">I have received the goods shipped under this lorry receipt in Good condition.</p>
        <div class="pod-sign-row">
          <span>Name and Signature</span>
          <span>Seal of the Consignee</span>
        </div>
      </div>
    </div>

    <div class="lr-foot">The Terms and Conditions of this lorry receipt are mentioned on [&quot;T&amp;Cs&quot;]. If you are unable to see the T&amp;Cs you may contact ${escapeHtml(company.name)}. All disputes are subject to ${escapeHtml(company.state)} jurisdiction only. The Goods under this At Customer&apos;s/Insurance Risk</div>
  </section>`;
}

export function buildLrHtml(
  data: TripLrSnapshot,
  opts?: { logoDataUrl?: string; qrDataUrl?: string; company?: CompanyProfile }
) {
  const company = opts?.company;
  if (!company) {
    throw new Error("buildLrHtml requires company profile");
  }
  const logoDataUrl = opts?.logoDataUrl ?? loadBrandLogoDataUrl(company.logoPath);
  const qrDataUrl = opts?.qrDataUrl ?? "";
  const pages = LR_PAGES.map(
    ([top, bottom]) => `
    <div class="lr-page">
      ${renderBtLrCopy(top, data, company, logoDataUrl, qrDataUrl)}
      <div class="lr-cut"></div>
      ${renderBtLrCopy(bottom, data, company, logoDataUrl, qrDataUrl)}
    </div>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>LR ${escapeHtml(data.lrNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 3mm; }
    html, body { width: 210mm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7pt;
      color: #111;
      line-height: 1.2;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .lr-page {
      width: 204mm;
      margin: 0 auto;
      page-break-after: always;
      page-break-inside: avoid;
    }
    .lr-page:last-child { page-break-after: auto; }
    .lr-copy {
      height: 141mm;
      max-height: 141mm;
      padding: 1.5mm 2mm 1mm;
      overflow: hidden;
    }
    .lr-cut {
      border-top: 1px dashed ${LR_NAVY};
      margin: 1mm 8mm 0.5mm;
    }
    .lr-head {
      display: table;
      width: 100%;
      margin-bottom: 1mm;
    }
    .lr-head-left, .lr-head-right {
      display: table-cell;
      vertical-align: top;
    }
    .lr-head-right { width: 32mm; text-align: right; }
    .lr-doc-type {
      font-size: 9pt;
      font-weight: 700;
      color: ${LR_NAVY};
      margin-bottom: 0.5mm;
    }
    .lr-co-name {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .lr-co-line { font-size: 6.5pt; color: #334155; line-height: 1.25; }
    .logo { height: 11mm; width: auto; max-width: 32mm; object-fit: contain; }
    .logo-text { font-size: 14pt; font-weight: 800; color: ${LR_NAVY}; }
    .lr-ship-row { width: 100%; margin-bottom: 0; }
    .lr-bar3-cell { vertical-align: middle; padding: 0; border: none; }
    .copy-cell {
      width: 22mm;
      vertical-align: middle;
      padding: 0;
      border: none;
    }
    .copy-badge {
      background: #e8edf2;
      border: 1px solid #94a3b8;
      padding: 2mm 1mm;
      font-size: 7.5pt;
      font-weight: 700;
      color: #1e293b;
      text-align: center;
      line-height: 1.15;
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .lr-bar3 .c-ship { width: 46%; }
    .lr-bar3 .c-lr { width: 27%; }
    .lr-bar3 .c-date { width: 27%; }
    .lr-bar3 th {
      background: ${LR_NAVY};
      color: #fff;
      font-size: 7pt;
      font-weight: 700;
      padding: 1mm 1.5mm;
      border: 1px solid ${LR_NAVY};
      text-align: center;
    }
    .lr-bar3 td {
      border: 1px solid #94a3b8;
      padding: 1mm 1.5mm;
      font-size: 7pt;
      text-align: center;
      vertical-align: middle;
      word-wrap: break-word;
    }
    .lr-bar3 td.strong { font-weight: 700; }
    .lr-party-grid { border: 1px solid #94a3b8; border-top: none; }
    .lr-party-grid .c-party { width: 34%; }
    .lr-party-grid .c-meta { width: 32%; }
    .lr-party-hdr th {
      background: #cfd8e3;
      color: ${LR_NAVY};
      font-size: 7pt;
      font-weight: 700;
      padding: 1mm 2mm;
      border: 1px solid #94a3b8;
      text-align: center;
    }
    .lr-party-hdr th.meta-hdr {
      background: ${LR_NAVY};
      color: #fff;
      text-align: left;
      font-size: 6.5pt;
      padding-left: 2mm;
    }
    .party-cell, .meta-cell {
      border: 1px solid #94a3b8;
      padding: 1.5mm 2mm;
      vertical-align: top;
      font-size: 6.5pt;
      height: 28mm;
    }
    .party-name { font-weight: 700; font-size: 7pt; margin-bottom: 0.5mm; }
    .party-addr { font-size: 6.5pt; line-height: 1.2; min-height: 12mm; }
    .party-meta-row { font-size: 6.5pt; margin-top: 1mm; }
    .party-meta-row span { font-weight: 700; }
    .party-mobile { margin-top: auto; padding-top: 2mm; }
    .meta-layout { width: 100%; border: none; }
    .meta-layout td { border: none; padding: 0; vertical-align: middle; }
    .meta-kv-cell { width: 58%; }
    .lr-meta-kv { font-size: 6.5pt; width: 100%; table-layout: fixed; }
    .lr-meta-kv col.meta-lbl-col { width: 46%; }
    .lr-meta-kv col.meta-val-col { width: 54%; }
    .lr-meta-kv td { border: none; padding: 0.4mm 0; vertical-align: top; }
    .lr-meta-kv .lbl {
      font-weight: 700;
      padding-right: 2mm;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    .lr-meta-kv .val { padding-left: 1.5mm; word-wrap: break-word; }
    .lr-qr-wrap { width: 42%; text-align: right; }
    .doc-qr { width: 18mm; height: 18mm; display: inline-block; }
    .goods-desc {
      border: 1px solid #94a3b8;
      border-top: none;
      padding: 1mm 2mm;
      font-size: 7pt;
    }
    .goods-desc .lbl { font-weight: 700; color: ${LR_NAVY}; }
    .lr-goods th, .lr-eway th {
      background: ${LR_NAVY};
      color: #fff;
      font-size: 6.5pt;
      font-weight: 700;
      padding: 1mm 0.5mm;
      border: 1px solid ${LR_NAVY};
      text-align: center;
    }
    .lr-goods td, .lr-eway td {
      border: 1px solid #94a3b8;
      padding: 1mm 0.5mm;
      font-size: 6.5pt;
      text-align: center;
      vertical-align: middle;
      word-wrap: break-word;
    }
    .lr-eway td:last-child { text-align: left; font-size: 6pt; }
    .lr-decl { display: table; width: 100%; table-layout: fixed; margin-top: 0.5mm; }
    .decl-box {
      display: table-cell;
      border: 1px solid #94a3b8;
      padding: 1mm 1.5mm;
      font-size: 5.5pt;
      color: #334155;
      line-height: 1.15;
      vertical-align: top;
    }
    .decl-title { font-weight: 700; font-size: 6pt; color: #111; margin-bottom: 0.5mm; }
    .decl-box p { margin: 0; }
    .decl-note { margin-top: 1mm !important; font-style: italic; }
    .decl-sign { margin-top: 2mm; text-align: center; font-size: 5.5pt; color: #64748b; }
    .pod-wrap { border: 1px solid ${LR_NAVY}; margin-top: 0.5mm; }
    .pod-title {
      background: ${LR_NAVY};
      color: #fff;
      font-size: 7pt;
      font-weight: 700;
      text-align: center;
      padding: 1mm;
    }
    .pod-body { padding: 1.5mm 2mm 1mm; font-size: 6.5pt; }
    .pod-line { margin-bottom: 0.5mm; }
    .pod-line span { font-weight: 700; }
    .pod-note { font-size: 6pt; margin: 1mm 0 0.5mm; }
    .pod-sign-row {
      display: table;
      width: 100%;
      margin-top: 2mm;
      padding-top: 3mm;
      border-top: 1px solid #cbd5e1;
      font-size: 6pt;
      color: #64748b;
    }
    .pod-sign-row span {
      display: table-cell;
      width: 50%;
      text-align: center;
    }
    .lr-foot {
      font-size: 5pt;
      color: #64748b;
      text-align: center;
      padding-top: 0.5mm;
      line-height: 1.1;
    }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;
}

export async function findTripLrAttachment(tripId: string) {
  return prisma.documentAttachment.findFirst({
    where: { entityType: "TRIP", entityId: tripId, documentType: "LR" },
    orderBy: { createdAt: "desc" },
    include: { file: true },
  });
}

export async function getTripLrDocument(tripId: string): Promise<TripLrPdfResult> {
  const att = await findTripLrAttachment(tripId);
  if (!att?.file?.url) {
    return { ok: false, error: "LR document not found" };
  }
  return {
    ok: true,
    url: att.file.url,
    generatedAt: att.createdAt,
    fileId: att.file.id,
  };
}

async function removeExistingLrDocuments(tripId: string) {
  const existing = await prisma.documentAttachment.findMany({
    where: { entityType: "TRIP", entityId: tripId, documentType: "LR" },
    include: { file: true },
  });
  for (const att of existing) {
    if (att.file?.url) await removeObject(att.file.url).catch(() => {});
    await prisma.documentAttachment.delete({ where: { id: att.id } });
    if (att.fileId) {
      await prisma.storedFile.delete({ where: { id: att.fileId } }).catch(() => {});
    }
  }
}

export async function generateTripLrPdf(
  tripId: string,
  actor?: SessionUser | null,
  opts?: { forceRegenerate?: boolean }
): Promise<TripLrPdfResult> {
  const existing = await findTripLrAttachment(tripId);
  if (existing?.file?.url && !opts?.forceRegenerate) {
    return {
      ok: true,
      url: existing.file.url,
      generatedAt: existing.createdAt,
      fileId: existing.file.id,
    };
  }

  const snapshot = await loadTripLrSnapshot(tripId);
  if (!snapshot) {
    return { ok: false, error: "Trip not found" };
  }

  try {
    const company = await getCompanyProfile();
    const qrDataUrl = await qrCodePngDataUrl(buildTripLrOpenUrl(tripId), 120);
    const html = buildLrHtml(snapshot, { qrDataUrl, company });
    const pdfBytes = await renderHtmlToPdf(html, {
      format: "A4",
      landscape: false,
      marginMm: { top: 4, right: 4, bottom: 4, left: 4 },
    });

    if (opts?.forceRegenerate) {
      await removeExistingLrDocuments(tripId);
    }

    const safeLr = snapshot.lrNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `lr/${tripId}/${safeLr}.pdf`;
    const { url } = await putObject(key, pdfBytes);

    const stored = await prisma.storedFile.create({
      data: {
        fileName: `${safeLr}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: pdfBytes.length,
        storageKey: key,
        url,
        uploadedById: actor?.id ?? null,
      },
    });

    await prisma.documentAttachment.create({
      data: {
        fileId: stored.id,
        entityType: "TRIP",
        entityId: tripId,
        documentType: "LR",
        title: `Lorry Receipt ${snapshot.lrNumber}`,
      },
    });

    await logAudit({
      user: actor,
      action: "trip.lr_generated",
      entity: "TRIP",
      entityId: tripId,
      meta: { lrNumber: snapshot.lrNumber, url, regenerated: Boolean(opts?.forceRegenerate) },
    });

    return { ok: true, url, generatedAt: new Date(), fileId: stored.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "LR PDF generation failed";
    console.error("[generateTripLrPdf]", tripId, message);
    return { ok: false, error: message };
  }
}

export async function regenerateTripLrPdf(tripId: string, actor?: SessionUser | null) {
  return generateTripLrPdf(tripId, actor, { forceRegenerate: true });
}
