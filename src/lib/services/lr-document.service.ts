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
  remarks: string;
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
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}) {
  return [parts.line1, parts.line2, parts.city, parts.state, parts.pincode]
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
    remarks: dash(trip.remarks),
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

  return `
  <section class="lr-copy">
    <div class="lr-top">
      <div class="lr-top-left">
        <div class="lr-doc-type">Lorry Receipt – Non-Negotiable</div>
        <div class="lr-co-name">${escapeHtml(company.name)}</div>
        <div class="lr-co-line">${escapeHtml(company.address)}</div>
        <div class="lr-co-line">PAN: ${escapeHtml(company.pan)} · GST: ${escapeHtml(company.gstin)}</div>
        <div class="lr-co-line">Tel: ${escapeHtml(company.phone)} · ${escapeHtml(company.email)}</div>
      </div>
      <div class="lr-top-right">
        ${logoImg}
        <div class="copy-badge">${escapeHtml(copyLabel)}</div>
      </div>
    </div>

    <table class="lr-bar3">
      <tr>
        <th>SHIPPER</th>
        <th>LR NUMBER</th>
        <th>BOOKING DATE</th>
      </tr>
      <tr>
        <td>${escapeHtml(data.consignorName)}</td>
        <td class="strong">${escapeHtml(data.lrNumber)}</td>
        <td>${escapeHtml(formatLrBookingDate(data.lrDate))}</td>
      </tr>
    </table>

    <div class="lr-mid">
      <table class="lr-party">
        <tr><th colspan="2">CONSIGNOR</th></tr>
        <tr><td colspan="2" class="party-name">${escapeHtml(data.consignorName)}</td></tr>
        <tr><td colspan="2" class="party-addr">${escapeHtml(data.consignorAddress)}</td></tr>
        <tr><td>GSTIN</td><td>${escapeHtml(data.consignorGstin)}</td></tr>
        <tr><td>MOBILE</td><td>${escapeHtml(data.consignorPhone)}</td></tr>
        <tr><th colspan="2">CONSIGNEE</th></tr>
        <tr><td colspan="2" class="party-name">${escapeHtml(data.consigneeName)}</td></tr>
        <tr><td colspan="2" class="party-addr">${escapeHtml(data.consigneeAddress)}</td></tr>
        <tr><td>GSTIN</td><td>${escapeHtml(data.consigneeGstin)}</td></tr>
        <tr><td>MOBILE</td><td>${escapeHtml(data.consigneePhone)}</td></tr>
      </table>
      <div class="lr-vehicle-qr">
        <table class="lr-vehicle">
          <tr><td class="lbl">Customer Code</td><td>${escapeHtml(data.customerCode)}</td></tr>
          <tr><td class="lbl">Vehicle</td><td>${escapeHtml(data.vehicleReg)}</td></tr>
          <tr><td class="lbl">Vehicle Type</td><td>${escapeHtml(data.vehicleType)}</td></tr>
          <tr><td class="lbl">Driver Name</td><td>${escapeHtml(data.driverName)}</td></tr>
          <tr><td class="lbl">Driver Mobile</td><td>${escapeHtml(data.driverPhone)}</td></tr>
          <tr><td class="lbl">DL No.</td><td>${escapeHtml(data.driverDl)}</td></tr>
          <tr><td class="lbl">Route</td><td>${escapeHtml(data.routeFrom)} → ${escapeHtml(data.routeTo)}</td></tr>
          <tr><td class="lbl">Indent / Client</td><td>${escapeHtml(dash(data.indentNumber))} · ${escapeHtml(data.clientName)}</td></tr>
        </table>
        ${qrImg ? `<div class="lr-qr-cell">${qrImg}</div>` : ""}
      </div>
    </div>

    <div class="goods-desc"><span class="lbl">GOODS DESC:</span> ${escapeHtml(data.cargoDescription)}</div>

    <table class="lr-goods">
      <tr>
        <th>SHIPPER INVOICE NOS</th>
        <th>DECLARED VALUE</th>
        <th># PACKAGES</th>
        <th>GROSS WT</th>
        <th>CHARGEABLE WT</th>
        <th>INSURANCE</th>
      </tr>
      <tr>
        <td>${escapeHtml(data.invoiceNumber)}</td>
        <td>${escapeHtml(data.invoiceValue)}</td>
        <td>${escapeHtml(data.packageCount)}</td>
        <td>${escapeHtml(data.weightText)}</td>
        <td>${escapeHtml(data.weightText)}</td>
        <td>${escapeHtml(data.insuranceRisk)}</td>
      </tr>
    </table>

    <table class="lr-eway">
      <tr>
        <th>E-WayBill No</th>
        <th>Valid Till</th>
        <th>Comments / Freight</th>
      </tr>
      <tr>
        <td>${escapeHtml(data.ewayBillNumber)}</td>
        <td>${escapeHtml(data.ewayValidUntil)}</td>
        <td>${escapeHtml(formatINR(data.clientRate))} (${escapeHtml(data.freightType)} / ${escapeHtml(data.paymentMode)}) · Carrier: ${escapeHtml(data.vendorName)}</td>
      </tr>
    </table>

    <div class="lr-decl">
      <div class="decl-box">
        <strong>Acknowledgement</strong>
        <p>Goods received in apparent good condition for carriage. Computer-generated LR — signature optional at loading.</p>
      </div>
      <div class="decl-box">
        <strong>Shipper declaration</strong>
        <p>Shipper declares particulars of goods are correct and accepts carrier terms. ${escapeHtml(data.remarks !== "—" ? data.remarks : "")}</p>
      </div>
    </div>

    <div class="pod-wrap">
      <div class="pod-title">PROOF OF DELIVERY</div>
      <div class="pod-body">
        <div class="pod-left">
          <div class="pod-line"><span>DATE:</span> ____________________</div>
          <div class="pod-line"><span>TIME:</span> ____________________</div>
          <p class="pod-note">I have received the goods shipped under this lorry receipt in good condition.</p>
          <div class="pod-sign-space" aria-hidden="true"></div>
          <div class="pod-sign">Name &amp; Signature of Receiver</div>
        </div>
        <div class="pod-right">
          <div class="pod-seal">Seal of the Consignee</div>
        </div>
      </div>
    </div>

    <div class="lr-foot">Subject to jurisdiction at ${escapeHtml(company.state)}. Terms &amp; conditions of carriage apply. E&amp;OE.</div>
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
    @page { size: A4; margin: 3mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 6.5px; color: #111; line-height: 1.2; }
    .lr-page { height: 291mm; display: flex; flex-direction: column; page-break-after: always; }
    .lr-page:last-child { page-break-after: auto; }
    .lr-copy { flex: 1 1 50%; min-height: 0; padding: 2px 4px; display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
    .lr-cut { flex: 0 0 0; border-top: 1px dashed #64748b; margin: 1px 8px; }
    .lr-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
    .lr-doc-type { font-size: 7px; font-weight: 700; color: ${LR_NAVY}; }
    .lr-co-name { font-size: 7.5px; font-weight: 700; text-transform: uppercase; }
    .lr-co-line { font-size: 5.5px; color: #334155; }
    .lr-top-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .logo { height: 22px; width: auto; max-width: 110px; object-fit: contain; }
    .logo-text { font-size: 12px; font-weight: 800; color: ${LR_NAVY}; }
    .copy-badge { background: #e2e8f0; border: 1px solid #94a3b8; padding: 3px 10px; font-size: 8px; font-weight: 700; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; }
    .lr-bar3 th { background: ${LR_NAVY}; color: #fff; font-size: 6px; padding: 2px 4px; border: 1px solid ${LR_NAVY}; text-align: center; }
    .lr-bar3 td { border: 1px solid #94a3b8; padding: 2px 4px; font-size: 6.5px; text-align: center; vertical-align: top; }
    .lr-bar3 td.strong { font-weight: 700; }
    .lr-mid { display: flex; gap: 3px; flex: 0 0 auto; }
    .lr-party, .lr-vehicle { border: 1px solid #94a3b8; font-size: 5.5px; }
    .lr-party { flex: 1.1; }
    .lr-vehicle-qr { flex: 0.9; display: flex; gap: 2px; align-items: stretch; min-width: 0; }
    .lr-vehicle { flex: 1; width: 100%; }
    .lr-qr-cell { flex: 0 0 46px; display: flex; align-items: center; justify-content: center; border: 1px solid #94a3b8; background: #fff; padding: 2px; }
    .doc-qr { width: 42px; height: 42px; display: block; }
    .lr-party th, .lr-vehicle .lbl { background: #f1f5f9; font-weight: 700; font-size: 5.5px; }
    .lr-party th, .lr-party td, .lr-vehicle td { border: 1px solid #cbd5e1; padding: 1px 3px; vertical-align: top; }
    .party-name { font-weight: 700; font-size: 6px; }
    .party-addr { font-size: 5.5px; }
    .goods-desc { border: 1px solid #94a3b8; padding: 2px 4px; font-size: 6px; }
    .goods-desc .lbl { font-weight: 700; color: ${LR_NAVY}; }
    .lr-goods th, .lr-eway th { background: ${LR_NAVY}; color: #fff; font-size: 5.5px; padding: 2px; border: 1px solid ${LR_NAVY}; text-align: center; }
    .lr-goods td, .lr-eway td { border: 1px solid #94a3b8; padding: 2px 3px; font-size: 5.5px; text-align: center; }
    .lr-decl { display: flex; gap: 3px; font-size: 5px; color: #334155; }
    .decl-box { flex: 1; border: 1px solid #cbd5e1; padding: 2px 3px; }
    .decl-box p { margin-top: 1px; }
    .pod-wrap { border: 1px solid ${LR_NAVY}; flex: 0 0 auto; display: flex; flex-direction: column; }
    .pod-title { background: ${LR_NAVY}; color: #fff; font-size: 6px; font-weight: 700; text-align: center; padding: 2px; }
    .pod-body { display: flex; flex: 0 0 auto; padding: 4px 3px; gap: 3px; align-items: stretch; }
    .pod-left { flex: 1.2; font-size: 5.5px; display: flex; flex-direction: column; }
    .pod-line { margin-bottom: 1px; }
    .pod-line span { font-weight: 700; }
    .pod-note { font-size: 5px; margin: 1px 0 2px; line-height: 1.15; }
    .pod-sign-space { flex: 0 0 auto; min-height: 22px; border-bottom: 1px solid #94a3b8; margin-top: 2px; }
    .pod-sign { margin-top: 2px; text-align: center; font-size: 5px; color: #64748b; }
    .pod-right { flex: 0.8; display: flex; align-items: center; justify-content: center; border: 1px dashed #94a3b8; min-height: 34px; }
    .pod-seal { font-size: 5.5px; color: #64748b; text-align: center; }
    .lr-foot { font-size: 4.5px; color: #64748b; text-align: center; padding-top: 1px; }
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
    const qrDataUrl = await qrCodePngDataUrl(buildTripLrOpenUrl(tripId), 88);
    const html = buildLrHtml(snapshot, { qrDataUrl, company });
    const pdfBytes = await renderHtmlToPdf(html, { marginMm: { top: 2, right: 2, bottom: 2, left: 2 } });

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
