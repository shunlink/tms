import { describe, expect, it } from "vitest";
import { mapIndentToFlat, type IndentWithRelations } from "./indent";

function minimalIndent(lines: { id: string; lineNumber: number }[]): IndentWithRelations {
  return {
    id: "ind-1",
    indentNumber: "IND-1",
    status: "PLACEMENT_PENDING",
    allocationMode: "MANUAL",
    indentDate: new Date(),
    remarks: null,
    clientId: "c1",
    requirementId: null,
    source: "ADMIN",
    advanceStatus: "PENDING",
    advanceRequested: null,
    advanceApproved: null,
    releasedAt: null,
    vendorId: "v1",
    allocatedQuoteId: null,
    vendorAllocatedAt: new Date(),
    placementStatus: "PLACEMENT_PENDING",
    placementDeadlineAt: new Date(),
    vehicleId: null,
    driverId: null,
    podReceivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    biddingLoadRequirementId: null,
    biddingBidId: null,
    biddingBidAcceptanceId: null,
    biddingHandoffKey: null,
    createdById: null,
    client: { id: "c1", name: "Client", gstin: null, phone: null },
    requirement: null,
    consignment: {
      indentId: "ind-1",
      serviceType: "GTA",
      transactionType: "SPOT",
      vehicleTypeCode: "TRUCK_17FT",
      bodyTypeCode: null,
      vehicleQuantity: lines.length,
      insuranceType: "NONE",
      cargoTypeCode: "GENERAL",
      weightValue: null,
      weightUnit: "MT",
      packageCount: null,
      capacityCbm: null,
      pickupAt: null,
      deliveryAt: null,
      podDueAt: null,
      ewayBillRequired: false,
      specialInstructions: null,
    },
    ewayBill: null,
    loading: null,
    unloading: null,
    cargo: null,
    clientFreight: { indentId: "ind-1", clientRate: null, currency: "INR", freightType: null, paymentMode: null, gstApplicable: true, gstRate: null },
    vendor: null,
    vehicle: null,
    driver: null,
    payments: [],
    releaseCities: [],
    lines: lines.map((l) => ({
      id: l.id,
      indentId: "ind-1",
      lineNumber: l.lineNumber,
      status: "ALLOCATED",
      vehicleTypeCode: "TRUCK_17FT",
      bodyTypeCode: null,
      placementStatus: "PLACEMENT_PENDING",
      placementReachedAt: null,
      tripId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      allocations: [],
      trip: null,
    })),
    trips: [],
    quotes: [],
    pods: [],
    importantEvents: [],
    trackingPings: [],
  } as IndentWithRelations;
}

describe("mapIndentToFlat vehicleSlots", () => {
  it("exposes one slot per indent line", () => {
    const flat = mapIndentToFlat(
      minimalIndent([
        { id: "l1", lineNumber: 1 },
        { id: "l2", lineNumber: 2 },
        { id: "l3", lineNumber: 3 },
      ])
    );
    expect(flat.vehicleSlots).toHaveLength(3);
    expect(flat.vehicleSlots.map((s) => s.lineNumber)).toEqual([1, 2, 3]);
  });
});
