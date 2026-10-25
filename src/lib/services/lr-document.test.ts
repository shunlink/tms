import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEFAULT_COMPANY_PROFILE } from "../company";
import { buildLrHtml, type TripLrSnapshot, generateTripLrPdf } from "./lr-document.service";

function sampleSnapshot(overrides: Partial<TripLrSnapshot> = {}): TripLrSnapshot {
  return {
    tripId: "trip-1",
    lrNumber: "LR-2026-00042",
    lrDate: new Date("2026-03-01T10:00:00.000Z"),
    indentNumber: "IND-100",
    requirementNumber: "REQ-9",
    lineNumber: 1,
    clientName: "Tata Steel",
    routeFrom: "Jamshedpur",
    routeTo: "Kolkata",
    consignorName: "Shipper Co",
    consignorAddress: "Plant Gate 1, Jamshedpur",
    consignorGstin: "20AAAAA0000A1Z5",
    consignorContact: "Ramesh",
    consignorPhone: "919876543210",
    consigneeName: "Receiver Ltd",
    consigneeAddress: "Warehouse 2, Kolkata",
    consigneeGstin: "19BBBBB0000B1Z5",
    consigneeContact: "Suresh",
    consigneePhone: "919812345678",
    cargoDescription: "HR Coils",
    hsnCode: "7208",
    packageCount: "12",
    weightText: "24 MT",
    invoiceNumber: "INV-77",
    invoiceValue: "₹12,00,000",
    freightType: "To Pay",
    paymentMode: "TBB",
    clientRate: 85000,
    ewayBillNumber: "EWB123",
    ewayValidUntil: "02 Mar 2026",
    vehicleReg: "JH05AB1234",
    vehicleType: "OPEN BODY",
    driverName: "Ravi Kumar",
    driverPhone: "919900112233",
    driverDl: "DL-09-2019-1234567",
    vendorName: "Sharma Transport",
    vendorGstin: "20CCCC0000C1Z5",
    remarks: "Handle with care",
    insuranceRisk: "Owner's Risk",
    customerCode: "IND-100",
    ...overrides,
  };
}

describe("buildLrHtml", () => {
  it("includes LR number, four stakeholder copies, and POD block", () => {
    const html = buildLrHtml(sampleSnapshot(), {
      company: DEFAULT_COMPANY_PROFILE,
      logoDataUrl: "",
      qrDataUrl: "data:image/png;base64,abc",
    });
    expect(html).toContain("LR-2026-00042");
    expect(html).toContain("Shipper Copy");
    expect(html).toContain("Consignee Copy");
    expect(html).toContain("Driver Copy");
    expect(html).toContain("Accounts Copy");
    expect(html).toContain("Lorry Receipt");
    expect(html).toContain("PROOF OF DELIVERY");
    expect(html).toContain('class="doc-qr"');
    expect(html).toContain("lr-qr-cell");
    expect(html).toContain("DATE:");
    expect(html).toContain("TIME:");
    expect(html).toContain("Jamshedpur");
    expect(html).toContain("Kolkata");
  });

  it("escapes HTML in party names", () => {
    const html = buildLrHtml(sampleSnapshot({ consignorName: "<script>alert(1)</script>" }), {
      company: DEFAULT_COMPANY_PROFILE,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

vi.mock("../prisma", () => ({
  prisma: {
    documentAttachment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    trip: { findFirst: vi.fn() },
    storedFile: { create: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("../storage", () => ({
  putObject: vi.fn(),
  removeObject: vi.fn(),
}));

vi.mock("../pdf/render-html-to-pdf", () => ({
  renderHtmlToPdf: vi.fn(),
}));

vi.mock("../audit", () => ({
  logAudit: vi.fn(),
}));

import { prisma } from "../prisma";
import { putObject } from "../storage";
import { renderHtmlToPdf } from "../pdf/render-html-to-pdf";

describe("generateTripLrPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing attachment without rendering when LR already exists", async () => {
    const createdAt = new Date("2026-03-01T12:00:00.000Z");
    vi.mocked(prisma.documentAttachment.findFirst).mockResolvedValue({
      id: "att-1",
      createdAt,
      fileId: "f1",
      file: { id: "f1", url: "https://storage/lr.pdf" },
    } as never);

    const result = await generateTripLrPdf("trip-1");

    expect(result).toEqual({
      ok: true,
      url: "https://storage/lr.pdf",
      generatedAt: createdAt,
      fileId: "f1",
    });
    expect(renderHtmlToPdf).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });
});
