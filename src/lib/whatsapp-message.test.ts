import { describe, it, expect } from "vitest";
import {
  buildDriverOtpMessage,
  buildIndentBidMessage,
  buildIndentBidSubject,
  buildQuoteAckMessage,
  buildVendorAllocatedMessage,
  formatAmount,
  formatMessageDate,
  formatMessageDateTime,
  formatWeight,
  WHATSAPP_QUOTE_BUTTON_TITLE,
} from "./whatsapp-message";
import { parseQuoteMessage } from "./whatsapp-parse";

const fullIndent = {
  indentNumber: "IND-2026-0001",
  clientName: "Tata Steel",
  fromCity: "Jamshedpur",
  fromState: "Jharkhand",
  toCity: "Pune",
  toState: "Maharashtra",
  vehicleType: "17 ft Truck",
  bodyType: "Open Body",
  quantity: 2,
  weightValue: 18,
  weightUnit: "MT",
  cargoType: "Steel",
  materialDescription: "MS Coils",
  pickupAt: "2026-01-15T06:00:00Z",
  deliveryAt: "2026-01-17T06:00:00Z",
  advanceAmount: 42000,
  ewayBillRequired: true,
  specialInstructions: "Tarpaulin required",
};

describe("formatAmount", () => {
  it("uses Indian digit grouping", () => {
    expect(formatAmount(42000)).toBe("42,000");
    expect(formatAmount(120000)).toBe("1,20,000");
  });

  it("returns null for missing values", () => {
    expect(formatAmount(null)).toBeNull();
    expect(formatAmount(undefined)).toBeNull();
  });
});

describe("formatWeight", () => {
  it("formats value with its unit", () => {
    expect(formatWeight(18, "MT")).toBe("18 MT");
    expect(formatWeight(1500, "KG")).toBe("1,500 KG");
  });

  it("defaults to MT and rejects non-positive values", () => {
    expect(formatWeight(5, null)).toBe("5 MT");
    expect(formatWeight(0, "MT")).toBeNull();
    expect(formatWeight(null, "MT")).toBeNull();
  });
});

describe("formatMessageDate", () => {
  it("renders IST dates", () => {
    expect(formatMessageDate("2026-01-15T06:00:00Z")).toBe("15 Jan 2026");
    expect(formatMessageDateTime("2026-01-15T06:00:00Z")).toContain("15 Jan 2026");
  });

  it("rolls over to the next IST day when UTC is late evening", () => {
    expect(formatMessageDate("2026-01-15T20:00:00Z")).toBe("16 Jan 2026");
  });

  it("returns null for missing or invalid dates", () => {
    expect(formatMessageDate(null)).toBeNull();
    expect(formatMessageDate("not-a-date")).toBeNull();
  });
});

describe("buildIndentBidSubject", () => {
  it("names the indent", () => {
    expect(buildIndentBidSubject("IND-2026-0001")).toBe("New indent: IND-2026-0001");
  });
});

describe("buildIndentBidMessage", () => {
  const message = buildIndentBidMessage(fullIndent);

  it("shows the indent identity and route", () => {
    expect(message).toContain("IND-2026-0001");
    expect(message).toContain("Tata Steel");
    expect(message).toContain("Jamshedpur, Jharkhand");
    expect(message).toContain("Pune, Maharashtra");
  });

  it("shows the load details a vendor needs to price the trip", () => {
    expect(message).toContain("17 ft Truck · Open Body");
    expect(message).toContain("Vehicles needed: 2");
    expect(message).toContain("Weight: 18 MT");
    expect(message).toContain("Cargo: Steel · MS Coils");
    expect(message).toContain("Pickup: 15 Jan 2026");
    expect(message).toContain("Delivery by: 17 Jan 2026");
    expect(message).toContain("Advance paid: INR 42,000");
    expect(message).toContain("E-way bill: Required");
    expect(message).toContain("Tarpaulin required");
  });

  it("tells the vendor how to bid via the interactive button flow", () => {
    expect(message).toContain(WHATSAPP_QUOTE_BUTTON_TITLE);
    expect(message).toContain("example: 43000");
    expect(message).toContain(`quote ${fullIndent.indentNumber} 43000`);
  });

  it("still accepts the legacy full-quote reply format", () => {
    expect(parseQuoteMessage(`quote ${fullIndent.indentNumber} 42000`)).toEqual({
      indentNumber: "IND-2026-0001",
      quotedRate: 42000,
    });
  });

  it("omits optional lines when the indent has no such data", () => {
    const minimal = buildIndentBidMessage({ indentNumber: "IND-2026-0002" });
    expect(minimal).toContain("IND-2026-0002");
    expect(minimal).not.toContain("Client:");
    expect(minimal).not.toContain("Route:");
    expect(minimal).not.toContain("Vehicle:");
    expect(minimal).not.toContain("Weight:");
    expect(minimal).not.toContain("E-way bill");
    expect(minimal).not.toContain("Vehicles needed");
  });

  it("does not repeat a single-vehicle quantity", () => {
    const single = buildIndentBidMessage({ indentNumber: "IND-2026-0003", quantity: 1 });
    expect(single).not.toContain("Vehicles needed");
  });
});

describe("buildQuoteAckMessage", () => {
  it("confirms the recorded rate", () => {
    const message = buildQuoteAckMessage({
      vendorName: "Sharma Transport",
      indentNumber: "IND-2026-0001",
      quotedRate: 42000,
    });
    expect(message).toContain("Quote received");
    expect(message).toContain("Sharma Transport");
    expect(message).toContain("INR 42,000");
    expect(message).toContain("IND-2026-0001");
  });
});

describe("buildVendorAllocatedMessage", () => {
  it("states the indent, route and vehicle", () => {
    const message = buildVendorAllocatedMessage({
      vendorName: "Aditya Logistics",
      indentNumber: "IND-2026-0001",
      fromCity: "Jamshedpur",
      toCity: "Pune",
      vehicleType: "17 ft Truck",
    });
    expect(message).toContain("allocated to you");
    expect(message).toContain("Aditya Logistics");
    expect(message).toContain("Jamshedpur to Pune");
    expect(message).toContain("17 ft Truck");
  });
});

describe("buildDriverOtpMessage", () => {
  it("includes the code and validity window", () => {
    const message = buildDriverOtpMessage("482913");
    expect(message).toContain("482913");
    expect(message).toContain("10 minutes");
  });
});
