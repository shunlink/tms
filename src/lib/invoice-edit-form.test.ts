import { describe, expect, it } from "vitest";
import { mapInvoiceDetailToEditFormTrips } from "./invoice-edit-form";

describe("mapInvoiceDetailToEditFormTrips", () => {
  it("groups lines by trip and keeps DB line ids for PATCH", () => {
    const { billing, trips } = mapInvoiceDetailToEditFormTrips({
      id: "inv1",
      invoiceNumber: "INV-1",
      issueDate: new Date(),
      dueDate: new Date(),
      status: "DRAFT",
      finalizedAt: null,
      subTotal: 1000,
      gstAmount: 180,
      totalAmount: 1180,
      paidAmount: 0,
      billingName: "Acme",
      billingGstin: "27AAAAA0000A1Z5",
      billingAddress: "Nagpur",
      billingEmail: "a@acme.test",
      paymentTermsDays: 15,
      eInvoiceIrn: null,
      eInvoiceAckNo: null,
      eInvoiceGeneratedAt: null,
      client: {
        id: "c1",
        name: "Acme Logistics",
        gstin: "27AAAAA0000A1Z5",
        address: "Nagpur",
        phone: null,
        email: "a@acme.test",
      },
      trips: [
        {
          id: "line-freight",
          tripId: "t1",
          lineKind: "FREIGHT",
          lrNumber: "LR1",
          routeFrom: "A",
          routeTo: "B",
          route: "A → B",
          description: "Freight",
          clientRate: 1000,
          cargoSummary: "Cement",
          vehicleReg: "MH12AB1234",
          indentNumber: "IND-1",
          gstRate: 0.18,
          gstAmount: 180,
        },
        {
          id: "line-load",
          tripId: "t1",
          lineKind: "LOADING",
          lrNumber: "LR1",
          routeFrom: "A",
          routeTo: "B",
          route: "A → B",
          description: "Loading",
          clientRate: 100,
          cargoSummary: null,
          vehicleReg: "MH12AB1234",
          indentNumber: "IND-1",
          gstRate: 0.18,
          gstAmount: 18,
        },
      ],
      payments: [],
    } as Parameters<typeof mapInvoiceDetailToEditFormTrips>[0]);

    expect(billing.billingName).toBe("Acme");
    expect(trips).toHaveLength(1);
    expect(trips[0].id).toBe("t1");
    expect(trips[0].lines.map((l) => l.id)).toEqual(["line-freight", "line-load"]);
    expect(trips[0].lines[0].amount).toBe(1000);
  });
});
