import { prisma } from "../prisma";
import { getCompanyProfile } from "../company";
import { formatINR, formatDate } from "../utils";
import { amountInWordsINR } from "../amount-in-words";
import { isInterStateSupply, splitGstAmount, gstStateCode } from "../gst-place-of-supply";
import { renderHtmlToPdf } from "../pdf/render-html-to-pdf";
import type { ClientInvoiceLineKind } from "../invoice-line-kinds";
import { panFromGstin, gstStateName, formatInvoiceDate } from "../invoice-gstin";
import { loadBrandLogoDataUrl } from "./lr-document.service";
import { buildInvoiceDetailPageUrl, qrCodeInlineSvg } from "../document-qr";

const GTA_SAC = "996511";
const INVOICE_NAVY = "#1a3c6e";

export type InvoiceLineInput = {
  id: string;
  tripId: string;
  lineKind: string;
  amount: number;
  gstRate: number | null;
  gstAmount: number | null;
  description: string | null;
  lrNumber: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  cargoSummary: string | null;
  vehicleReg: string | null;
  indentNumber: string | null;
};

export type TripInvoiceRow = {
  tripId: string;
  serialNo: number;
  lrNumber: string;
  lrDate: Date;
  vehicleReg: string;
  routeFrom: string;
  routeTo: string;
  consignor: string;
  consignee: string;
  material: string;
  hsnCode: string;
  packages: string;
  weight: string;
  clientInvoiceNo: string;
  clientInvoiceValue: string;
  freight: number;
  loading: number;
  unloading: number;
  taxable: number;
  gstRate: number;
  gstAmount: number;
  lineTotal: number;
  indentNumber: string | null;
  vehicleType: string;
  weightMt: string;
  particulars: string;
  containerNo: string;
};

export type InvoicePrintSnapshot = {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | null;
  status: string;
  paymentTermsDays: number | null;
  placeOfSupply: string;
  interState: boolean;
  indentNumbers: string[];
  reverseCharge: "Yes" | "No";
  referenceNo: string;
  tripNoLabel: string;
  bookingTypeLabel: string;
  pickupLocation: string;
  deliveryLocation: string;
  paymentTermsLabel: string;
  termsOfDelivery: string;
  lrRemarks: string;
  gstRatePercent: number;
  /** E-invoice IRN (when integrated); shown on print like BuckleTrack. */
  eInvoiceIrn: string | null;
  eInvoiceAckNo: string | null;
  billFrom: {
    name: string;
    address: string;
    gstin: string;
    pan: string;
    phone: string;
    email: string;
    stateName: string;
    stateCode: string;
  };
  billTo: {
    name: string;
    address: string | null;
    gstin: string | null;
    pan: string | null;
    email: string | null;
    stateCode: string | null;
    stateName: string | null;
    placeOfSupply: string;
  };
  rows: TripInvoiceRow[];
  subTotal: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  paidAmount: number;
  amountInWords: string;
  companyBank: {
    bankName: string;
    bankAccount: string;
    bankBranch: string;
    bankIfsc: string;
  };
};

function n(v: { toNumber(): number } | number | null | undefined) {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

function dash(v: string | null | undefined) {
  const t = v?.trim();
  return t ? t : "—";
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type GroupableLine = InvoiceLineInput;

export function groupLinesByTrip(lines: GroupableLine[]): Omit<TripInvoiceRow, "serialNo">[] {
  const byTrip = new Map<string, GroupableLine[]>();
  for (const line of lines) {
    const list = byTrip.get(line.tripId) ?? [];
    list.push(line);
    byTrip.set(line.tripId, list);
  }

  const rows: Omit<TripInvoiceRow, "serialNo">[] = [];

  for (const [tripId, tripLines] of Array.from(byTrip.entries())) {
    const first = tripLines[0];
    let freight = 0;
    let loading = 0;
    let unloading = 0;
    let gstAmount = 0;
    let gstRate = first.gstRate ?? 0.18;

    for (const l of tripLines) {
      const kind = (l.lineKind ?? "FREIGHT") as ClientInvoiceLineKind;
      const amt = l.amount;
      if (kind === "LOADING") loading += amt;
      else if (kind === "UNLOADING") unloading += amt;
      else freight += amt;
      gstAmount += l.gstAmount ?? Math.round(amt * (l.gstRate ?? gstRate) * 100) / 100;
      if (l.gstRate != null) gstRate = l.gstRate;
    }

    const taxable = freight + loading + unloading;
    const lineTotal = Math.round((taxable + gstAmount) * 100) / 100;

    rows.push({
      tripId,
      lrNumber: first.lrNumber ?? "—",
      lrDate: new Date(0),
      vehicleReg: dash(first.vehicleReg),
      routeFrom: dash(first.routeFrom),
      routeTo: dash(first.routeTo),
      consignor: "—",
      consignee: "—",
      material: dash(first.cargoSummary ?? first.description),
      hsnCode: "—",
      packages: "—",
      weight: "—",
      clientInvoiceNo: "—",
      clientInvoiceValue: "—",
      freight,
      loading,
      unloading,
      taxable,
      gstRate,
      gstAmount: Math.round(gstAmount * 100) / 100,
      lineTotal,
      indentNumber: first.indentNumber,
      vehicleType: "—",
      weightMt: "—",
      particulars: "Freight Charges",
      containerNo: "—",
    });
  }

  return rows.sort((a, b) => a.lrNumber.localeCompare(b.lrNumber));
}

function lineParticulars(freight: number, loading: number, unloading: number) {
  if (loading > 0 || unloading > 0) return "Freight & Handling Charges";
  return "Freight Charges";
}

const tripLineInclude = {
  trip: {
    include: {
      vehicle: { select: { registrationNumber: true, vehicleTypeCode: true } },
      indent: {
        include: {
          loading: true,
          unloading: true,
          cargo: true,
          consignment: true,
        },
      },
    },
  },
};

export async function loadInvoicePrintSnapshot(invoiceId: string): Promise<InvoicePrintSnapshot | null> {
  const inv = await prisma.clientInvoice.findFirst({
    where: { id: invoiceId },
    include: {
      client: {
        include: {
          addresses: { include: { address: true } },
        },
      },
      lines: {
        include: tripLineInclude,
        orderBy: { trip: { lrNumber: "asc" } },
      },
    },
  });
  if (!inv) return null;

  const company = await getCompanyProfile();

  const useSnapshot = Boolean(inv.finalizedAt);
  const billingGstin = useSnapshot && inv.billingGstin ? inv.billingGstin : inv.client.gstin;
  const billingName =
    useSnapshot && inv.billingName ? inv.billingName : inv.client.legalName ?? inv.client.name;
  const billingAddrRow =
    inv.client.addresses.find((a) => a.type === "BILLING") ??
    inv.client.addresses.find((a) => a.isPrimary) ??
    inv.client.addresses[0];
  const billingAddressFromClient = billingAddrRow
    ? [
        billingAddrRow.address.line1,
        billingAddrRow.address.line2,
        billingAddrRow.address.city,
        billingAddrRow.address.state,
        billingAddrRow.address.pincode,
      ]
        .filter(Boolean)
        .join(", ")
    : null;
  const billingAddress =
    useSnapshot && inv.billingAddress ? inv.billingAddress : billingAddressFromClient;
  const billingEmail = useSnapshot && inv.billingEmail ? inv.billingEmail : inv.client.email;
  const billingPan = inv.client.pan ?? panFromGstin(billingGstin);

  const interState = isInterStateSupply(company.gstin, billingGstin);
  const recipientState = gstStateCode(billingGstin);
  const recipientStateName = gstStateName(recipientState);
  const supplierStateCode = gstStateCode(company.gstin) ?? "07";
  const supplierStateName = gstStateName(supplierStateCode) ?? company.state;

  const flatLines: InvoiceLineInput[] = inv.lines.map((line) => ({
    id: line.id,
    tripId: line.tripId,
    lineKind: line.lineKind,
    amount: n(line.amount),
    gstRate: line.gstRate != null ? n(line.gstRate) : null,
    gstAmount: line.gstAmount != null ? n(line.gstAmount) : null,
    description: line.description,
    lrNumber: line.lrNumber ?? line.trip.lrNumber,
    routeFrom: line.routeFrom,
    routeTo: line.routeTo,
    cargoSummary: line.cargoSummary,
    vehicleReg: line.vehicleReg,
    indentNumber: line.indentNumber ?? line.trip.indent?.indentNumber ?? null,
  }));

  const grouped = groupLinesByTrip(flatLines);

  const rows: TripInvoiceRow[] = grouped.map((row, idx) => {
    const tripLine = inv.lines.find((l) => l.tripId === row.tripId);
    const trip = tripLine?.trip;
    const indent = trip?.indent;
    const loading = indent?.loading;
    const unloading = indent?.unloading;
    const cargo = indent?.cargo;
    const consignment = indent?.consignment;

    const weightVal = trip?.loadingWeight ?? consignment?.weightValue;
    const weightUnit = consignment?.weightUnit ?? "MT";
    const weight =
      weightVal != null ? `${n(weightVal)} ${weightUnit}` : row.weight;
    const weightMt = weightVal != null ? String(n(weightVal)) : "—";
    const vType = trip?.vehicle?.vehicleTypeCode?.replace(/_/g, " ") ?? "—";

    return {
      ...row,
      serialNo: idx + 1,
      lrDate: trip?.dispatchedAt ?? trip?.createdAt ?? inv.issueDate,
      consignor: dash(loading?.partyName ?? loading?.city),
      consignee: dash(unloading?.partyName ?? unloading?.city),
      material: dash(row.material === "—" ? cargo?.description : row.material),
      hsnCode: dash(cargo?.hsnCode) === "—" ? GTA_SAC : dash(cargo?.hsnCode),
      packages: consignment?.packageCount != null ? String(consignment.packageCount) : "—",
      weight,
      weightMt,
      clientInvoiceNo: dash(cargo?.invoiceNumber),
      clientInvoiceValue:
        cargo?.invoiceValue != null ? formatINR(n(cargo.invoiceValue)) : "—",
      vehicleReg:
        row.vehicleReg !== "—"
          ? row.vehicleReg
          : dash(trip?.vehicle?.registrationNumber),
      vehicleType: vType,
      particulars: lineParticulars(row.freight, row.loading, row.unloading),
      containerNo: "—",
    };
  });

  const indentNumbers = Array.from(
    new Set(rows.map((r) => r.indentNumber).filter(Boolean) as string[])
  );

  const subTotal = n(inv.subTotal);
  const gstAmount = n(inv.gstAmount);
  const totalAmount = n(inv.totalAmount);
  const paidAmount = n(inv.paidAmount);
  const split = splitGstAmount(gstAmount, interState);
  const gstRatePercent =
    rows[0]?.gstRate != null ? Math.round(rows[0].gstRate * 10000) / 100 : 0;

  const pickupCities = Array.from(
    new Set(rows.map((r) => r.routeFrom).filter((c) => c && c !== "—"))
  );
  const deliveryCities = Array.from(
    new Set(rows.map((r) => r.routeTo).filter((c) => c && c !== "—"))
  );
  const pickupLocation =
    pickupCities.length === 0
      ? "—"
      : pickupCities.length === 1
        ? pickupCities[0]!
        : "Multiple";
  const deliveryLocation =
    deliveryCities.length === 0
      ? "—"
      : deliveryCities.length === 1
        ? deliveryCities[0]!
        : "Multiple";

  const lrList = rows.map((r) => r.lrNumber).join(", ");
  const reverseCharge: "Yes" | "No" = gstAmount === 0 ? "Yes" : "No";
  const placeOfSupplyBillTo =
    recipientStateName && recipientState
      ? `${deliveryCities[0] ?? billingAddrRow?.address.city ?? "—"}, ${recipientStateName}`
      : company.state;

  return {
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    status: inv.status,
    paymentTermsDays: inv.paymentTermsDays,
    placeOfSupply: placeOfSupplyBillTo,
    interState,
    indentNumbers,
    reverseCharge,
    referenceNo: indentNumbers.join(", ") || "—",
    tripNoLabel: rows.length === 1 ? rows[0]!.lrNumber : "Multiple",
    bookingTypeLabel: indentNumbers.length <= 1 ? (indentNumbers[0] ?? "Single") : "Multiple",
    pickupLocation,
    deliveryLocation,
    paymentTermsLabel: `${inv.paymentTermsDays ?? 30} Days Credit`,
    termsOfDelivery: "Rate Check",
    lrRemarks: `LR no - ${lrList}`,
    eInvoiceIrn: inv.eInvoiceIrn,
    eInvoiceAckNo: inv.eInvoiceAckNo,
    gstRatePercent,
    billFrom: {
      name: company.name,
      address: company.address,
      gstin: company.gstin,
      pan: company.pan,
      phone: company.phone,
      email: company.email,
      stateName: supplierStateName,
      stateCode: supplierStateCode,
    },
    companyBank: {
      bankName: company.bankName,
      bankAccount: company.bankAccount,
      bankBranch: company.bankBranch,
      bankIfsc: company.bankIfsc,
    },
    billTo: {
      name: billingName,
      address: billingAddress,
      gstin: billingGstin,
      pan: billingPan,
      email: billingEmail,
      stateCode: recipientState,
      stateName: recipientStateName,
      placeOfSupply: placeOfSupplyBillTo,
    },
    rows,
    subTotal,
    gstAmount,
    cgst: split.cgst,
    sgst: split.sgst,
    igst: split.igst,
    totalAmount,
    paidAmount,
    amountInWords: amountInWordsINR(totalAmount),
  };
}

function renderBtLineTable(rows: TripInvoiceRow[]) {
  const body = rows
    .map(
      (r) => `
    <tr>
      <td class="c">${r.serialNo}</td>
      <td>${escapeHtml(r.particulars)}</td>
      <td>${escapeHtml(r.lrNumber)}</td>
      <td>${escapeHtml(r.vehicleType)}</td>
      <td>${escapeHtml(r.containerNo)}</td>
      <td class="c">${escapeHtml(r.weightMt)}</td>
      <td>${escapeHtml(r.clientInvoiceNo)}</td>
      <td>${escapeHtml(r.vehicleReg)}</td>
      <td class="c">${escapeHtml(r.hsnCode)}</td>
      <td class="r">${escapeHtml(formatINR(r.taxable))}</td>
    </tr>`
    )
    .join("");

  return `
  <table class="lines">
    <colgroup>
      <col class="sl" /><col class="part" /><col class="lr" /><col class="vt" /><col class="cont" />
      <col class="wt" /><col class="cinv" /><col class="vno" /><col class="hsn" /><col class="amt" />
    </colgroup>
    <thead>
      <tr>
        <th>Sl.No.</th><th>Particulars</th><th>LR No.</th><th>Vehicle Type</th><th>Container No.</th>
        <th>Wt. (MT)</th><th>Invoice No.</th><th>Vehicle No.</th><th>HSN/SAC</th><th>Amount</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

export function buildInvoiceTaxHtml(
  snapshot: InvoicePrintSnapshot,
  opts?: { logoDataUrl?: string; qrSvg?: string; qrDataUrl?: string }
) {
  const logoDataUrl = opts?.logoDataUrl ?? loadBrandLogoDataUrl();
  const logoImg = logoDataUrl
    ? `<img class="logo" src="${logoDataUrl}" alt="Shunlink" />`
    : `<span class="logo-text">Shunlink</span>`;
  const qrInner = opts?.qrSvg
    ? opts.qrSvg
    : opts?.qrDataUrl
      ? `<img class="doc-qr" src="${opts.qrDataUrl}" alt="View invoice online" />`
      : "";
  const qrBlock = qrInner
    ? `<div class="inv-qr-block">${qrInner}</div>`
    : "";

  const rcmRemark =
    snapshot.reverseCharge === "Yes"
      ? `Remarks : "GST payable under Reverse Charge by the recipient." (GTA)`
      : `Remarks : Freight under GTA — tax charged on this invoice at ${snapshot.gstRatePercent}%.`;

  const cgstPct = snapshot.interState ? 0 : snapshot.gstRatePercent / 2;
  const sgstPct = cgstPct;
  const igstPct = snapshot.interState ? snapshot.gstRatePercent : 0;

  const billToState =
    snapshot.billTo.stateName && snapshot.billTo.stateCode
      ? `${snapshot.billTo.stateName}, Code : ${snapshot.billTo.stateCode}`
      : snapshot.billTo.stateCode
        ? `Code : ${snapshot.billTo.stateCode}`
        : "—";

  const billFromState =
    snapshot.billFrom.stateName && snapshot.billFrom.stateCode
      ? `${snapshot.billFrom.stateName}, Code : ${snapshot.billFrom.stateCode}`
      : snapshot.billFrom.stateCode
        ? `Code : ${snapshot.billFrom.stateCode}`
        : "—";

  const irnLine = snapshot.eInvoiceIrn?.trim()
    ? escapeHtml(snapshot.eInvoiceIrn.trim())
    : "—";
  const ackLine = snapshot.eInvoiceAckNo?.trim()
    ? escapeHtml(snapshot.eInvoiceAckNo.trim())
    : "—";

  const bankBranchIfsc = [snapshot.companyBank.bankBranch, snapshot.companyBank.bankIfsc]
    .filter(Boolean)
    .join(" - ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Tax Invoice ${escapeHtml(snapshot.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 4mm; }
    html, body { width: 210mm; max-width: 210mm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7pt;
      color: #111;
      line-height: 1.2;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { width: 100%; padding: 0; }
    .inv-reg {
      text-align: center;
      font-size: 6pt;
      color: #475569;
      line-height: 1.15;
      margin-bottom: 1mm;
    }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    .inv-head-table {
      border: 1px solid #111;
      border-bottom: none;
    }
    .inv-head-table td {
      border: 1px solid #111;
      padding: 2mm 2.5mm;
      vertical-align: top;
    }
    .head-logo { width: 38%; }
    .head-title { width: 34%; text-align: center; vertical-align: middle !important; }
    .head-qr, .inv-head-right { width: 28%; text-align: right; vertical-align: top; }
    .logo { height: 10mm; width: auto; max-width: 38mm; object-fit: contain; display: block; }
    .logo-text { font-size: 13pt; font-weight: 800; color: ${INVOICE_NAVY}; }
    .tax-title { font-size: 12pt; font-weight: 700; }
    .einv-lines { margin-top: 2mm; font-size: 6pt; line-height: 1.25; word-break: break-all; }
    .einv-lines div { margin-top: 0.5mm; }
    .einv-lines b { font-weight: 700; margin-right: 1mm; }
    .inv-qr-block .doc-qr, .doc-qr-svg { width: 16mm; height: 16mm; display: inline-block; }
    .inv-bill-table { border: 1px solid #111; border-top: none; }
    .inv-bill-table > tbody > tr > td { border: 1px solid #111; vertical-align: top; padding: 0; }
    .bill-left { width: 50%; }
    .bill-meta { width: 50%; }
    .bill-block { padding: 2mm 2.5mm; min-height: 32mm; }
    .bill-block + .bill-block { border-top: 1px solid #111; }
    .bill-h { font-weight: 700; font-size: 7pt; text-decoration: underline; margin-bottom: 1mm; }
    .bill-block p { margin: 0.3mm 0; font-size: 6.5pt; }
    .meta-pairs td {
      border: 1px solid #94a3b8;
      padding: 1mm 1.5mm;
      font-size: 6.5pt;
      vertical-align: top;
    }
    .meta-pairs td.lbl {
      font-weight: 600;
      width: 22%;
      background: #f8fafc;
    }
    .meta-pairs td.val { width: 28%; }
    .rcm-bar {
      border: 1px solid #111;
      border-top: none;
      padding: 1.5mm 2.5mm;
      font-size: 6.5pt;
      font-weight: 700;
      background: #f1f5f9;
    }
    table.lines {
      font-size: 6pt;
      border: 1px solid #111;
      border-top: none;
    }
    table.lines th {
      background: ${INVOICE_NAVY};
      color: #fff;
      padding: 1mm 0.5mm;
      border: 1px solid ${INVOICE_NAVY};
      text-align: center;
      font-weight: 600;
      font-size: 6pt;
    }
    table.lines td {
      border: 1px solid #94a3b8;
      padding: 0.8mm 1mm;
      vertical-align: top;
      word-wrap: break-word;
    }
    table.lines col.sl { width: 4%; }
    table.lines col.part { width: 11%; }
    table.lines col.lr { width: 9%; }
    table.lines col.vt { width: 10%; }
    table.lines col.cont { width: 8%; }
    table.lines col.wt { width: 6%; }
    table.lines col.cinv { width: 9%; }
    table.lines col.vno { width: 9%; }
    table.lines col.hsn { width: 8%; }
    table.lines col.amt { width: 10%; }
    td.c { text-align: center; }
    td.r { text-align: right; white-space: nowrap; }
    .totals-stack { border: 1px solid #111; border-top: none; }
    .totals-stack td { padding: 0; border: none; vertical-align: top; }
    .totals-empty { width: 58%; }
    .totals-panel { width: 42%; padding: 1.5mm 2.5mm; border-left: 1px solid #111; }
    .totals-panel table { width: 100%; font-size: 6.5pt; }
    .totals-panel td { padding: 0.4mm 0; }
    .totals-panel td.r { text-align: right; font-weight: 600; }
    .totals-panel tr.grand td { font-weight: 700; font-size: 7pt; border-top: 1px solid #111; padding-top: 1mm; }
    .words-row {
      border: 1px solid #111;
      border-top: none;
    }
    .words-row td {
      border: 1px solid #111;
      padding: 2mm 2.5mm;
      font-size: 6.5pt;
      vertical-align: middle;
    }
    .words-cell { width: 85%; }
    .eoe-cell {
      width: 15%;
      text-align: center;
      font-weight: 700;
      font-size: 7pt;
      vertical-align: middle !important;
    }
    .lr-remarks {
      border: 1px solid #111;
      border-top: none;
      padding: 1.5mm 2.5mm;
      font-size: 6.5pt;
      font-style: italic;
    }
    .footer-table { border: 1px solid #111; border-top: none; }
    .footer-table td {
      border: 1px solid #111;
      padding: 2mm 2.5mm;
      font-size: 6pt;
      vertical-align: top;
    }
    .footer-left { width: 64%; }
    .footer-right { width: 36%; }
    .bank-h { font-weight: 700; text-decoration: underline; margin-bottom: 0.5mm; }
    .terms { margin-top: 1.5mm; }
    .terms ol { margin: 0.5mm 0 0 4mm; padding: 0; line-height: 1.15; }
    .for-co { text-align: right; font-weight: 700; margin-top: 10mm; font-size: 6.5pt; }
    .auth-sign { text-align: right; color: #64748b; margin-top: 2mm; font-size: 6pt; }
    .reg-line { margin-top: 1mm; font-size: 5.5pt; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="page">
    <div class="inv-reg">
      <div>This is a Computer Generated Invoice</div>
      <div>Regd. Office : ${escapeHtml(snapshot.billFrom.address)}</div>
      <div>Contact No. : ${escapeHtml(snapshot.billFrom.phone)} ; Email : ${escapeHtml(snapshot.billFrom.email)}</div>
    </div>

    <table class="inv-head-table">
      <tr>
        <td class="head-logo">
          ${logoImg}
          <div class="einv-lines">
            <div><b>IRN</b>${irnLine}</div>
            <div><b>Ack Number</b>${ackLine}</div>
          </div>
        </td>
        <td class="head-title"><div class="tax-title">Tax Invoice</div></td>
        <td class="head-qr inv-head-right">${qrBlock}</td>
      </tr>
    </table>

    <table class="inv-bill-table">
      <tr>
        <td class="bill-left">
          <div class="bill-block">
            <div class="bill-h">Bill To</div>
            <p><strong>${escapeHtml(snapshot.billTo.name)}</strong></p>
            ${snapshot.billTo.address ? `<p>${escapeHtml(snapshot.billTo.address)}</p>` : ""}
            ${snapshot.billTo.gstin ? `<p>GSTIN/UIN : ${escapeHtml(snapshot.billTo.gstin)}</p>` : ""}
            ${snapshot.billTo.pan ? `<p>PAN : ${escapeHtml(snapshot.billTo.pan)}</p>` : ""}
            <p>State Name : ${escapeHtml(billToState)}</p>
            <p>Place of Supply : ${escapeHtml(snapshot.billTo.placeOfSupply)}</p>
          </div>
          <div class="bill-block">
            <div class="bill-h">Bill From</div>
            <p><strong>${escapeHtml(snapshot.billFrom.name)}</strong></p>
            <p>${escapeHtml(snapshot.billFrom.address)}</p>
            <p>GSTIN/UIN : ${escapeHtml(snapshot.billFrom.gstin)}</p>
            <p>PAN : ${escapeHtml(snapshot.billFrom.pan)}</p>
            <p>State Name : ${escapeHtml(billFromState)}</p>
            <p>Contact Number : ${escapeHtml(snapshot.billFrom.phone)}</p>
            <p>Mail Id : ${escapeHtml(snapshot.billFrom.email)}</p>
          </div>
        </td>
        <td class="bill-meta">
          <table class="meta-pairs">
            <tr>
              <td class="lbl">Invoice No.</td><td class="val">${escapeHtml(snapshot.invoiceNumber)}</td>
              <td class="lbl">Dated</td><td class="val">${escapeHtml(formatInvoiceDate(snapshot.issueDate))}</td>
            </tr>
            <tr>
              <td class="lbl">Reference No.</td><td class="val">${escapeHtml(snapshot.referenceNo)}</td>
              <td class="lbl">RCM</td><td class="val">${escapeHtml(snapshot.reverseCharge)}</td>
            </tr>
            <tr>
              <td class="lbl">Trip No</td><td class="val">${escapeHtml(snapshot.tripNoLabel)}</td>
              <td class="lbl">Booking Type</td><td class="val">${escapeHtml(snapshot.bookingTypeLabel)}</td>
            </tr>
            <tr>
              <td class="lbl">Pickup Location</td><td class="val">${escapeHtml(snapshot.pickupLocation)}</td>
              <td class="lbl">Delivery Location</td><td class="val">${escapeHtml(snapshot.deliveryLocation)}</td>
            </tr>
            <tr>
              <td class="lbl">Invoice due date</td><td class="val">${escapeHtml(snapshot.dueDate ? formatInvoiceDate(snapshot.dueDate) : "—")}</td>
              <td class="lbl">Mode/Terms of Payment</td><td class="val">${escapeHtml(snapshot.paymentTermsLabel)}</td>
            </tr>
            <tr>
              <td class="lbl">Terms of Delivery</td><td class="val" colspan="3">${escapeHtml(snapshot.termsOfDelivery)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div class="rcm-bar">${escapeHtml(rcmRemark)}</div>
    ${renderBtLineTable(snapshot.rows)}

    <table class="totals-stack">
      <tr>
        <td class="totals-empty"></td>
        <td class="totals-panel">
          <table>
            <tr><td>Total</td><td class="r">${escapeHtml(formatINR(snapshot.subTotal))}</td></tr>
            <tr><td>Add: CGST @ ${cgstPct}%</td><td class="r">${escapeHtml(formatINR(snapshot.cgst))}</td></tr>
            <tr><td>Add: SGST @ ${sgstPct}%</td><td class="r">${escapeHtml(formatINR(snapshot.sgst))}</td></tr>
            <tr><td>Add: IGST @ ${igstPct}%</td><td class="r">${escapeHtml(formatINR(snapshot.igst))}</td></tr>
            <tr class="grand"><td>Grand Total</td><td class="r">${escapeHtml(formatINR(snapshot.totalAmount))}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <table class="words-row">
      <tr>
        <td class="words-cell">
          <strong>Amount Chargeable (in words)</strong><br />
          INR ${escapeHtml(snapshot.amountInWords)} Only
        </td>
        <td class="eoe-cell">E. &amp; O.E</td>
      </tr>
    </table>

    <div class="lr-remarks">Remarks : ${escapeHtml(snapshot.lrRemarks.replace(/^Remarks\s*:\s*/i, ""))}</div>

    <table class="footer-table">
      <tr>
        <td class="footer-left">
          <div class="bank-h">Company's Bank Details</div>
          <p>Bank Name : ${escapeHtml(snapshot.companyBank.bankName)}</p>
          <p>A/C No : ${escapeHtml(snapshot.companyBank.bankAccount)}</p>
          <p>Branch &amp; IFSC Code : ${escapeHtml(bankBranchIfsc || "—")}</p>
          <div class="terms">
            <strong>Terms &amp; Conditions</strong>
            <ol>
              <li>Any delayed payment beyond the due date shall attract interest at 24% per annum from the due date until the date of actual payment.</li>
              <li>Any modification or correction in LR, consignment details, or billing information must be informed in writing within 3 days from the date of issue; requests received thereafter may not be entertained.</li>
            </ol>
          </div>
        </td>
        <td class="footer-right">
          <div class="for-co">For ${escapeHtml(snapshot.billFrom.name)}</div>
          <div class="auth-sign">Authorized signatory</div>
        </td>
      </tr>
    </table>
    <div class="reg-line">Subject to ${escapeHtml(snapshot.billFrom.stateName)} jurisdiction. Freight under GTA (SAC ${GTA_SAC}).</div>
  </div>
</body>
</html>`;
}

/** Tax invoice HTML for on-screen preview and PDF (always includes QR). */
export async function buildInvoicePrintHtml(invoiceId: string): Promise<string> {
  const snapshot = await loadInvoicePrintSnapshot(invoiceId);
  if (!snapshot) throw new Error("Invoice not found");
  const qrSvg = await qrCodeInlineSvg(buildInvoiceDetailPageUrl(invoiceId), 56);
  return buildInvoiceTaxHtml(snapshot, { qrSvg });
}

export async function generateInvoicePdfBytes(invoiceId: string): Promise<Buffer> {
  const html = await buildInvoicePrintHtml(invoiceId);
  return renderHtmlToPdf(html, {
    format: "A4",
    landscape: false,
    marginMm: { top: 5, right: 5, bottom: 5, left: 5 },
  });
}
