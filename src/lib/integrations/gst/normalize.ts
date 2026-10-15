import type { GstVerificationStatus, NormalizedGstData } from "./types";

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function parseAddressDetails(raw: unknown): {
  address: string | null;
  state: string | null;
  city: string | null;
  pincode: string | null;
} {
  if (!raw || typeof raw !== "object") {
    return { address: null, state: null, city: null, pincode: null };
  }
  const o = raw as Record<string, unknown>;
  const principal = (o.principal_place_of_business ?? o.principal ?? o.primary) as Record<string, unknown> | undefined;
  if (principal && typeof principal === "object") {
    return {
      address: pickString(principal, "address", "addr"),
      state: pickString(principal, "state"),
      city: pickString(principal, "city", "district", "location"),
      pincode: pickString(principal, "pincode", "pin"),
    };
  }
  return {
    address: pickString(o, "address"),
    state: pickString(o, "state"),
    city: pickString(o, "city", "district"),
    pincode: pickString(o, "pincode", "pin"),
  };
}

function isActiveGstStatus(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("active") && !s.includes("inactive") && !s.includes("cancel");
}

export function normalizeSurepassGst(
  gstin: string,
  raw: Record<string, unknown>,
  provider = "surepass"
): NormalizedGstData {
  const addr = parseAddressDetails(raw.address_details);
  const flatAddress = pickString(raw, "address") ?? addr.address;
  const status = pickString(raw, "gstin_status", "status");
  const activities = Array.isArray(raw.nature_bus_activities)
    ? (raw.nature_bus_activities as string[]).filter(Boolean)
    : [];

  const verificationStatus: GstVerificationStatus = isActiveGstStatus(status) ? "VERIFIED" : "FAILED";

  return {
    gstin: pickString(raw, "gstin") ?? gstin,
    legalName: pickString(raw, "legal_name"),
    tradeName: pickString(raw, "business_name", "trade_name"),
    status,
    registrationDate: pickString(raw, "date_of_registration", "registration_date"),
    constitution: pickString(raw, "constitution_of_business"),
    taxpayerType: pickString(raw, "taxpayer_type"),
    principalAddress: flatAddress,
    state: addr.state ?? pickString(raw, "state_jurisdiction"),
    city: addr.city,
    pincode: addr.pincode,
    pan: pickString(raw, "pan_number", "pan"),
    stateJurisdiction: pickString(raw, "state_jurisdiction"),
    centerJurisdiction: pickString(raw, "center_jurisdiction"),
    businessActivities: activities,
    provider,
    verifiedAt: new Date().toISOString(),
    verificationStatus,
  };
}
