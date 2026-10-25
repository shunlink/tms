import { describe, expect, it } from "vitest";
import {
  buildInvoiceTaxHtml,
  groupLinesByTrip,
  type InvoiceLineInput,
} from "./invoice-document.service";
import { splitGstAmount, isInterStateSupply } from "../gst-place-of-supply";
import { amountInWordsINR } from "../amount-in-words";
import type { InvoicePrintSnapshot } from "./invoice-document.service";

function line(
  tripId: string,
  kind: string,
  amount: number,
  overrides: Partial<InvoiceLineInput> = {}
): InvoiceLineInput {
  return {
    id: `${tripId}-${kind}`,
    tripId,
    lineKind: kind,
    amount,
    gstRate: 0.18,
    gstAmount: Math.round(amount * 0.18 * 100) / 100,
    description: "Steel coils",
    lrNumber: `LR-${tripId}`,
    routeFrom: "Mumbai",
    routeTo: "Pune",
    cargoSummary: "Steel",
    vehicleReg: "MH12AB1234",
    indentNumber: "IND-1",
    ...overrides,
  };
}

describe("groupLinesByTrip", () => {
  it("merges freight, loading, and unloading into one row per trip", () => {
    const rows = groupLinesByTrip([
      line("t1", "FREIGHT", 10000),
      line("t1", "LOADING", 500),
      line("t1", "UNLOADING", 300),
      line("t2", "FREIGHT", 8000),
    ]);
    expect(rows).toHaveLength(2);
    const r1 = rows.find((r) => r.tripId === "t1");
    expect(r1?.freight).toBe(10000);
    expect(r1?.loading).toBe(500);
    expect(r1?.unloading).toBe(300);
    expect(r1?.taxable).toBe(10800);
  });
});

describe("buildInvoiceTaxHtml", () => {
  const snapshot: InvoicePrintSnapshot = {
    invoiceId: "inv-1",
    invoiceNumber: "INV-2026-001",
    issueDate: new Date("2026-03-01"),
    dueDate: new Date("2026-03-31"),
    status: "SENT",
    paymentTermsDays: 30,
    placeOfSupply: "Kolkata, West Bengal",
    interState: false,
    indentNumbers: ["IND-100"],
    reverseCharge: "No",
    referenceNo: "IND-100",
    tripNoLabel: "Multiple",
    bookingTypeLabel: "IND-100",
    pickupLocation: "Jamshedpur",
    deliveryLocation: "Kolkata",
    paymentTermsLabel: "30 Days Credit",
    termsOfDelivery: "As per booking",
    lrRemarks: "LR no - LR-001, LR-002",
    gstRatePercent: 18,
    billFrom: {
      name: "Shunlink Logistics Pvt. Ltd.",
      address: "Delhi",
      gstin: "07AAAAA0000A1Z5",
      pan: "AAAAA0000A",
      phone: "+91 98765 43210",
      email: "accounts@shunlink.in",
      stateName: "Delhi",
      stateCode: "07",
    },
    billTo: {
      name: "Tata Steel",
      address: "Jamshedpur",
      gstin: "20AAAAA0000A1Z5",
      pan: "AAAAA0000A",
      email: "ap@tata.com",
      stateCode: "20",
      stateName: "Jharkhand",
      placeOfSupply: "Kolkata, West Bengal",
    },
    rows: [
      {
        tripId: "t1",
        serialNo: 1,
        lrNumber: "LR-001",
        vehicleType: "OPEN BODY",
        weightMt: "20",
        particulars: "Freight Charges",
        containerNo: "—",
        lrDate: new Date("2026-02-28"),
        vehicleReg: "JH05XY1234",
        routeFrom: "Jamshedpur",
        routeTo: "Kolkata",
        consignor: "Plant",
        consignee: "WH",
        material: "HR Coils",
        hsnCode: "7208",
        packages: "10",
        weight: "20 MT",
        clientInvoiceNo: "CINV-1",
        clientInvoiceValue: "₹10,00,000",
        freight: 50000,
        loading: 0,
        unloading: 0,
        taxable: 50000,
        gstRate: 0.18,
        gstAmount: 9000,
        lineTotal: 59000,
        indentNumber: "IND-100",
      },
      {
        tripId: "t2",
        serialNo: 2,
        lrNumber: "LR-002",
        vehicleType: "OPEN BODY",
        weightMt: "20",
        particulars: "Freight Charges",
        containerNo: "—",
        lrDate: new Date("2026-02-28"),
        vehicleReg: "JH05XY5678",
        routeFrom: "Jamshedpur",
        routeTo: "Kolkata",
        consignor: "Plant",
        consignee: "WH",
        material: "HR Coils",
        hsnCode: "7208",
        packages: "10",
        weight: "20 MT",
        clientInvoiceNo: "CINV-2",
        clientInvoiceValue: "₹10,00,000",
        freight: 50000,
        loading: 0,
        unloading: 0,
        taxable: 50000,
        gstRate: 0.18,
        gstAmount: 9000,
        lineTotal: 59000,
        indentNumber: "IND-100",
      },
    ],
    subTotal: 100000,
    gstAmount: 18000,
    cgst: 9000,
    sgst: 9000,
    igst: 0,
    totalAmount: 118000,
    paidAmount: 0,
    amountInWords: amountInWordsINR(118000),
    companyBank: {
      bankName: "State Bank of India",
      bankAccount: "30212345678",
      bankBranch: "Transport Nagar",
      bankIfsc: "SBIN0001234",
    },
  };

  it("includes invoice number, both LRs, and BuckleTrack-style sections", () => {
    const html = buildInvoiceTaxHtml(snapshot, { logoDataUrl: "" });
    expect(html).toContain("INV-2026-001");
    expect(html).toContain("LR-001");
    expect(html).toContain("LR-002");
    expect(html).toContain("Tax Invoice");
    expect(html).toContain("Bill To");
    expect(html).toContain("Bill From");
    expect(html).toContain("Particulars");
    expect(html).toContain("Grand Total");
    expect(html).toContain("@page { size: A4 portrait");
  });

  it("includes QR block when qrSvg is provided", () => {
    const html = buildInvoiceTaxHtml(snapshot, {
      logoDataUrl: "",
      qrSvg: '<svg class="doc-qr-svg" width="56" height="56"></svg>',
    });
    expect(html).toContain("doc-qr-svg");
    expect(html).toContain("meta-with-qr");
    expect(html).toContain("Scan to view");
  });
});

describe("gst-place-of-supply", () => {
  it("splits GST for intra-state", () => {
    expect(splitGstAmount(180, false)).toEqual({ cgst: 90, sgst: 90, igst: 0 });
  });

  it("uses IGST for inter-state", () => {
    expect(splitGstAmount(180, true)).toEqual({ cgst: 0, sgst: 0, igst: 180 });
  });

  it("detects inter-state from GSTIN", () => {
    expect(isInterStateSupply("07AAAAA0000A1Z5", "27BBBBB0000B1Z5")).toBe(true);
    expect(isInterStateSupply("07AAAAA0000A1Z5", "07CCCCC0000C1Z5")).toBe(false);
  });
});
