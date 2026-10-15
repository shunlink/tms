import { describe, it, expect } from "vitest";
import {
  isValidIndianMobile,
  isValidPan,
  isValidGstin,
  isValidPincode,
  isValidVehicleReg,
  isValidOtp,
  normalizeVehicleReg,
} from "./field-validators";

describe("field validators", () => {
  it("validates Indian mobile numbers", () => {
    expect(isValidIndianMobile("9820012345")).toBe(true);
    expect(isValidIndianMobile("+91 98200 12345")).toBe(true);
    expect(isValidIndianMobile("5820012345")).toBe(false);
    expect(isValidIndianMobile("98200123")).toBe(false);
    expect(isValidIndianMobile("not-a-phone")).toBe(false);
  });

  it("validates PAN", () => {
    expect(isValidPan("ABCDE1234F")).toBe(true);
    expect(isValidPan("abcde1234f")).toBe(true);
    expect(isValidPan("ABCDE12345")).toBe(false);
  });

  it("validates GSTIN", () => {
    expect(isValidGstin("27AABCU9603R1ZM")).toBe(true);
    expect(isValidGstin("27AABCU9603R1Z")).toBe(false);
  });

  it("validates pincode", () => {
    expect(isValidPincode("400001")).toBe(true);
    expect(isValidPincode("040001")).toBe(false);
    expect(isValidPincode("40001")).toBe(false);
  });

  it("validates vehicle registration", () => {
    expect(isValidVehicleReg("MH 12 AB 1234")).toBe(true);
    expect(isValidVehicleReg(normalizeVehicleReg("dl1caf1234"))).toBe(true);
    expect(isValidVehicleReg("INVALID")).toBe(false);
  });

  it("validates OTP format", () => {
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("12ab56")).toBe(false);
  });
});
