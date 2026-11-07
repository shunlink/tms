import { describe, expect, it } from "vitest";
import { localDateInputValue } from "./date-input";
import { indentSaveSchema, splitIndentSaveFieldErrors } from "./validation";

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateInputValue(d);
}

const validBase = {
  clientId: "client-1",
  indentDate: addDays(0),
  serviceType: "GTA",
  transactionType: "SPOT",
  insuranceType: "NONE",
  cargoType: "GENERAL",
  consignorName: "Shipper Co",
  consignorAddress: "123 Industrial Area",
  consignorCity: "Mumbai",
  consignorState: "Maharashtra",
  consignorPincode: "400001",
  consignorGstin: "27AABCU9603R1ZM",
  pickupDate: addDays(1),
  consigneeName: "Receiver Co",
  consigneeAddress: "456 Market Road",
  consigneeCity: "Pune",
  consigneeState: "Maharashtra",
  consigneePincode: "411001",
  consigneeGstin: "27AABCU9603R1ZN",
  consigneeContact: "Ravi Kumar",
  consigneePhone: "9820012345",
  vehicleType: "TRUCK_17FT",
  quantity: 1,
  clientRate: 45000,
  ewayBillRequired: false,
};

describe("indentSaveSchema", () => {
  it("accepts a complete save payload", () => {
    const result = indentSaveSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("allows missing consignee contact and phone", () => {
    const result = indentSaveSchema.safeParse({
      ...validBase,
      consigneeContact: "",
      consigneePhone: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing client rate", () => {
    const result = indentSaveSchema.safeParse({ ...validBase, clientRate: "" });
    expect(result.success).toBe(false);
  });

  it("maps nested e-way GSTIN errors for the form UI", () => {
    const result = indentSaveSchema.safeParse({
      ...validBase,
      ewayBill: {
        mode: "EXISTING",
        supplierGstin: "29AARFB4347G000",
        recipientGstin: "27AARFB4347G024",
      },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const { form, eway } = splitIndentSaveFieldErrors(result.error.issues);
    expect(form.consignorGstin).toBeUndefined();
    expect(eway.supplierGstin).toMatch(/GSTIN/i);
    expect(eway.recipientGstin).toMatch(/GSTIN/i);
  });
});
