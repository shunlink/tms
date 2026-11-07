import { describe, expect, it } from "vitest";
import {
  formatAddressSuggestionLabel,
  mergeAndLimitSuggestions,
  normalizeAddressDedupeKey,
  toAddressSuggestion,
} from "./address-suggestion";

describe("address suggestion helpers", () => {
  it("formats full address, city, state, pincode labels", () => {
    expect(
      formatAddressSuggestionLabel({
        addressLine1: "Plot 12 Industrial Area",
        city: "Kanhan",
        state: "Maharashtra",
        pincode: "441401",
      })
    ).toBe("Plot 12 Industrial Area, Kanhan, Maharashtra, 441401");
  });

  it("omits empty parts from the label", () => {
    expect(
      formatAddressSuggestionLabel({
        addressLine1: "Near Bus Stand",
        city: "Kamthi",
        state: "",
        pincode: "441001",
      })
    ).toBe("Near Bus Stand, Kamthi, 441001");
  });

  it("never returns city-only when building a suggestion with only city", () => {
    const s = toAddressSuggestion({
      addressLine1: null,
      city: "Kanhan",
      state: "Maharashtra",
      pincode: "441401",
    });
    expect(s?.label).toBe("Kanhan, Maharashtra, 441401");
    expect(s?.label).not.toBe("Kanhan");
  });

  it("dedupes by normalized address key and limits to 5", () => {
    const rows = [
      {
        addressLine1: "A",
        city: "Kanhan",
        state: "MH",
        pincode: "1",
      },
      {
        addressLine1: "  a ",
        city: "kanhan",
        state: "mh",
        pincode: "1",
      },
      {
        addressLine1: "B",
        city: "Kamthi",
        state: "MH",
        pincode: "2",
      },
      {
        addressLine1: "C",
        city: "Nagpur",
        state: "MH",
        pincode: "3",
      },
      {
        addressLine1: "D",
        city: "Pune",
        state: "MH",
        pincode: "4",
      },
      {
        addressLine1: "E",
        city: "Mumbai",
        state: "MH",
        pincode: "5",
      },
      {
        addressLine1: "F",
        city: "Nashik",
        state: "MH",
        pincode: "6",
      },
    ];
    const merged = mergeAndLimitSuggestions([rows], 5);
    expect(merged).toHaveLength(5);
    expect(merged.map((m) => m.city)).toEqual([
      "Kanhan",
      "Kamthi",
      "Nagpur",
      "Pune",
      "Mumbai",
    ]);
    expect(normalizeAddressDedupeKey(rows[0])).toBe(normalizeAddressDedupeKey(rows[1]));
  });

  it("prefers earlier groups when merging", () => {
    const profile = [
      {
        addressLine1: "Billing HQ",
        city: "Nagpur",
        state: "MH",
        pincode: "440001",
      },
    ];
    const history = [
      {
        addressLine1: "Warehouse",
        city: "Kanhan",
        state: "MH",
        pincode: "441401",
      },
    ];
    const merged = mergeAndLimitSuggestions([profile, history], 5);
    expect(merged[0].label).toBe("Billing HQ, Nagpur, MH, 440001");
    expect(merged[1].label).toBe("Warehouse, Kanhan, MH, 441401");
  });
});
