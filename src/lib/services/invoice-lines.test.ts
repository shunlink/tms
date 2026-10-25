import { describe, expect, it } from "vitest";
import { invoiceSchema } from "../validation";
import { buildTripInvoiceLines } from "./invoice.service";

function mockTrip(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    id: "trip-1",
    lrNumber: "LR-001",
    routeFrom: "Mumbai",
    routeTo: "Pune",
    cargoSummary: "Steel",
    clientRate: 10000,
    clientLoadingCharge: 500,
    clientUnloadingCharge: 300,
    indent: {
      indentNumber: "IND-1",
      cargo: { description: "Steel" },
      clientFreight: { gstRate: 0.18 },
      loading: { city: "Mumbai" },
      unloading: { city: "Pune" },
      consignment: null,
    },
    vehicle: { registrationNumber: "MH12AB1234" },
  };
  return { ...base, ...overrides };
}

describe("invoiceSchema", () => {
  it("keeps lineKind on each submitted invoice line", () => {
    const parsed = invoiceSchema.safeParse({
      clientId: "c1",
      tripIds: ["t1"],
      gstRate: 0.18,
      lines: [
        { tripId: "t1", lineKind: "FREIGHT", amount: 400_000 },
        { tripId: "t1", lineKind: "LOADING", amount: 300 },
        { tripId: "t1", lineKind: "UNLOADING", amount: 300 },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.lines?.map((l) => l.lineKind)).toEqual(["FREIGHT", "LOADING", "UNLOADING"]);
    expect(parsed.data.lines?.[0].amount).toBe(400_000);
  });
});

describe("buildTripInvoiceLines", () => {
  it("emits freight only when loading/unloading are zero", () => {
    const trip = mockTrip({ clientLoadingCharge: 0, clientUnloadingCharge: 0 });
    const lines = buildTripInvoiceLines(
      trip as unknown as Parameters<typeof buildTripInvoiceLines>[0],
      0.18
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].lineKind).toBe("FREIGHT");
    expect(lines[0].amount).toBe(10000);
  });

  it("emits three lines when loading and unloading charges are set", () => {
    const lines = buildTripInvoiceLines(
      mockTrip() as unknown as Parameters<typeof buildTripInvoiceLines>[0],
      0.18
    );
    expect(lines.map((l) => l.lineKind)).toEqual(["FREIGHT", "LOADING", "UNLOADING"]);
    expect(lines[1].amount).toBe(500);
    expect(lines[2].amount).toBe(300);
  });
});
