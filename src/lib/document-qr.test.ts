import { describe, expect, it } from "vitest";
import {
  buildInvoiceDetailPageUrl,
  buildTripLrOpenUrl,
  getPublicAppBaseUrlOrFallback,
} from "./document-qr";

describe("document-qr urls", () => {
  it("builds invoice and LR deep links from public base", () => {
    const prev = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = "https://tms.example.com";
    expect(getPublicAppBaseUrlOrFallback()).toBe("https://tms.example.com");
    expect(buildInvoiceDetailPageUrl("inv-1")).toBe("https://tms.example.com/invoices/inv-1");
    expect(buildTripLrOpenUrl("trip-9")).toBe("https://tms.example.com/trips/trip-9/lr");
    process.env.PUBLIC_BASE_URL = prev;
  });
});
