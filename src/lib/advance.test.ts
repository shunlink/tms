import { describe, expect, it } from "vitest";
import {
  isVendorAdvancePaidStatus,
  resolveIndentPromisedAdvanceAmount,
  resolveTripVendorAdvance,
} from "./advance";

describe("resolveTripVendorAdvance", () => {
  it("returns processed advance with paidAmount from AdvanceRequest.paidAmount", () => {
    const adv = resolveTripVendorAdvance([
      {
        source: "SHUNLINK",
        status: "PROCESSED",
        requestNumber: "ADV-001",
        requestedAmount: 60000,
        approvedAmount: 50000,
        paidAmount: 50000,
        paymentMethod: "NEFT",
        utrReference: "UTR123",
        paymentDate: new Date("2026-10-01"),
        processedBy: { name: "Finance" },
        createdAt: new Date("2026-10-01"),
      },
    ]);
    expect(adv).toMatchObject({
      status: "PROCESSED",
      paidAmount: 50000,
      approvedAmount: 50000,
      paymentMethod: "NEFT",
      utrReference: "UTR123",
      outstandingAmount: 0,
    });
  });

  it("handles pending advance with outstanding approved amount", () => {
    const adv = resolveTripVendorAdvance([
      {
        source: "SHUNLINK",
        status: "APPROVED",
        requestedAmount: 60000,
        approvedAmount: 50000,
        createdAt: new Date(),
      },
    ]);
    expect(adv?.status).toBe("APPROVED");
    expect(adv?.paidAmount).toBeNull();
    expect(adv?.outstandingAmount).toBe(50000);
  });

  it("handles external advance", () => {
    const adv = resolveTripVendorAdvance([
      {
        source: "EXTERNAL",
        status: "EXTERNAL",
        externalProvider: "Rivigo",
        requestedAmount: 0,
        createdAt: new Date(),
      },
    ]);
    expect(adv?.status).toBe("EXTERNAL");
    expect(adv?.externalProvider).toBe("Rivigo");
  });

  it("returns null for rejected-only requests", () => {
    expect(
      resolveTripVendorAdvance([
        { source: "SHUNLINK", status: "REJECTED", requestedAmount: 1000, createdAt: new Date() },
      ])
    ).toBeNull();
  });
});

describe("resolveIndentPromisedAdvanceAmount", () => {
  it("prefers processed trip advance over legacy indent fields", () => {
    const amount = resolveIndentPromisedAdvanceAmount({
      advanceStatus: "PENDING",
      advanceRequested: { toNumber: () => 10000 },
      trips: [
        {
          advanceRequests: [
            {
              source: "SHUNLINK",
              status: "PROCESSED",
              paidAmount: 45000,
              approvedAmount: 45000,
              createdAt: new Date(),
            },
          ],
        },
      ],
    });
    expect(amount).toBe(45000);
  });
});

describe("isVendorAdvancePaidStatus", () => {
  it("treats PROCESSED and legacy PAID as paid", () => {
    expect(isVendorAdvancePaidStatus("PROCESSED")).toBe(true);
    expect(isVendorAdvancePaidStatus("PAID")).toBe(true);
    expect(isVendorAdvancePaidStatus("APPROVED")).toBe(false);
  });
});
