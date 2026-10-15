/**
 * One-off generator: docs/PORTAL_TOP_INSIGHTS_AND_AI.docx
 * Run: node scripts/generate-portal-insights-docx.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "docs", "PORTAL_TOP_INSIGHTS_AND_AI.docx");

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });
}
function bullet(text) {
  return new Paragraph({
    spacing: { after: 80 },
    bullet: { level: 0 },
    children: [new TextRun(text)],
  });
}

const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "ShunLink TMS — Portal insights (existing data)", bold: true, size: 32 })],
  }),
  p("Scope: Features and insights you can ship now by reading data already in PostgreSQL. No new tables or backend workflows. UI + query reads only (same pattern as src/lib/queries.ts)."),
  p("Source: prisma/schema.prisma and current portal pages under src/app/portal/client and src/app/portal/vendor."),

  h1("What portals show today"),
  h3("Client"),
  bullet("Overview: active/delivered trips, total outstanding, recent trips"),
  bullet("Requirements list (summary fields only)"),
  bullet("Trips list: route, vendor, vehicle, invoice link, last map ping, status"),
  bullet("Invoices list + invoice PDF/detail (includes payments on that invoice)"),
  bullet("Profile, KYC documents, commercials after approval"),

  h3("Vendor"),
  bullet("Overview: active/completed trips, POD pending alert, pending payment total, paid to date, recent trips"),
  bullet("Open indents (quote) with route, vehicle, pickup, weight, advance hint"),
  bullet("Trips + assignment indents list; trip detail: advance request, POD upload, trip documents"),
  bullet("Payments history (VendorPayment rows)"),
  bullet("Profile, fleet numbers (no compliance), documents"),

  h1("Client portal — top items not shown (data exists)"),
  bullet("Credit used vs credit limit — ClientCommercial.creditLimit + sum unpaid ClientInvoice"),
  bullet("Overdue invoices count/amount — ClientInvoice.status / dueDate vs paidAmount"),
  bullet("All payments ledger — ClientPayment across invoices (today only inside each invoice detail)"),
  bullet("Requirement → indent link — Requirement.indentId / Indent.indentNumber + Indent.status when CONVERTED"),
  bullet("Requirement full detail — cargo, consignor/consignee, pickup/delivery, HSN, instructions (Requirement table)"),
  bullet("Trip detail page — Trip.dispatchedAt, deliveredAt, podReceivedAt, cargoSummary, clientRate; driver/vehicle already on Trip"),
  bullet("Shipment documents — DocumentAttachment on TRIP/INDENT (POD, LR, EWAY_BILL); client has no trip doc view"),
  bullet("E-way snapshot — IndentEwayBill via Trip.indentId"),
  bullet("Tracking history — TrackingPing (only latest ping is linked from trips list)"),
  bullet("Indent status for active loads — Indent.status, placementStatus, advanceStatus for client’s indents"),
  bullet("Account activity counts — getClientDetail already loads _count indents/trips/invoices; not on overview"),

  h1("Vendor portal — top items not shown (data exists)"),
  bullet("Open vs allocated indent counts — already computed in getVendorPortalOverview (availableIndents, allocatedIndents) but not displayed"),
  bullet("Past quotes — VendorQuote (ACTIVE/ACCEPTED/REJECTED/WITHDRAWN) history and outcomes"),
  bullet("Trip payables — VendorTripPayable: freight, deductions, TDS, advance applied, balance due"),
  bullet("Balance payout status — VendorBalancePaymentTask + VendorBalancePayment (deadlineAt, slaBreachedAt, partial paid)"),
  bullet("Trip charges — TripCharge (detention/deduction lines)"),
  bullet("Placement deadline — IndentAllocation.deadlineAt on active allocation"),
  bullet("Fleet compliance — VehicleCompliance RC/insurance/fitness/PUC expiry (Vehicle on vendor; detail exists in DB)"),
  bullet("Vendor rating — Vendor.rating (loaded in getVendorDetail, not shown in profile UI)"),
  bullet("Open indent delivery date & cargo type — returned by getVendorOpenIndents (deliveryAt, cargoType) but not on cards"),
  bullet("POD verification state — IndentPod.status, rejectionReason (beyond pending trip list)"),
  bullet("Financial notes — FinancialNote where vendorId and status ISSUED (debit/credit to vendor)"),

  h1("AI features (on existing data only)"),
  p("These use an LLM or vision API in the portal layer; answers must be grounded in queries the app already can run for that user. No new stored fields required."),

  h2("Client"),
  bullet("Ask in plain language — e.g. outstanding amount, trips in transit, invoices overdue — over ClientInvoice, Trip, Requirement filtered by clientId"),
  bullet("Weekly summary — auto narrative from trip counts, deliveries, and invoice due dates in the last 7/30 days"),
  bullet("Invoice explainer — turn ClientInvoiceLine + Trip snapshot fields into a short plain-English breakdown"),
  bullet("Lane spend insight — rank routes by sum of Trip.clientRate or invoiced ClientInvoiceLine amounts (historical rows only)"),
  bullet("Document assist — when POD/LR files exist (StoredFile), optional vision check: readable/blurry before client download"),

  h2("Vendor"),
  bullet("Ask in plain language — pending balance, last payments, open indents — over VendorPayment, VendorTripPayable, open indents"),
  bullet("Earnings summary — narrative from VendorPayment.netPayable grouped by month and paymentType (ADVANCE/BALANCE)"),
  bullet("Quote helper — suggest rate band from vendor’s own past VendorQuote.quotedRate and ACCEPTED quotes on similar Trip.routeFrom/routeTo (same vendor only)"),
  bullet("Action digest — list next steps from trip status + IndentPod.status + AdvanceRequest.status + balance task status"),
  bullet("POD upload coach — vision feedback on POD photo quality (uses uploaded image; no new DB fields)"),

  h1("Suggested build order"),
  p("1) Client: overdue + credit utilization widgets. 2) Vendor: payables + balance task on payments/trip. 3) Both: trip/requirement detail pages with dates & docs. 4) AI: grounded Q&A + weekly summary."),
];

const doc = new Document({
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log("Wrote", outPath);
