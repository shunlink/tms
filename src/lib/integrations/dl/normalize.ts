import type { NormalizedDrivingLicence } from "./types";

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function extractVehicleClasses(raw: Record<string, unknown>): string[] {
  const classes: string[] = [];
  const cov = raw.cov_details ?? raw.all_class_of_vehicle ?? raw.vehicle_classes;
  if (Array.isArray(cov)) {
    for (const item of cov) {
      if (typeof item === "string") classes.push(item);
      else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const label = pickString(o, "cov", "class", "vehicle_class", "category");
        if (label) classes.push(label);
      }
    }
  }
  return classes;
}

export function normalizeSurepassDl(
  dlNumber: string,
  raw: Record<string, unknown>,
  provider = "surepass"
): NormalizedDrivingLicence {
  const status = pickString(raw, "status", "dl_status");
  const active = status?.toLowerCase().includes("active");
  const verificationStatus = active ? "VERIFIED" : status ? "FAILED" : "PENDING";

  return {
    dlNumber: pickString(raw, "dl_number", "driving_license_number", "license_number") ?? dlNumber,
    name: pickString(raw, "name", "full_name", "holder_name"),
    status,
    issueDate: pickString(raw, "issue_date", "doi", "date_of_issue"),
    validity: pickString(raw, "validity", "valid_upto"),
    expiryDate: pickString(raw, "expiry_date", "dl_expiry", "valid_upto"),
    dateOfBirth: pickString(raw, "dob", "date_of_birth"),
    vehicleClasses: extractVehicleClasses(raw),
    address: pickString(raw, "address", "complete_address"),
    state: pickString(raw, "state"),
    provider,
    verifiedAt: new Date().toISOString(),
    verificationStatus,
  };
}
