import type { DocumentValidity, NormalizedVehicleRc, VehicleComplianceState } from "./types";

export function parseValidityDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("1900")) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function documentValidity(
  expiry: string | null | undefined,
  statusHint?: string | null
): DocumentValidity {
  const hint = (statusHint ?? "").toLowerCase();
  if (hint.includes("expired") || hint.includes("inactive")) return "EXPIRED";
  const d = parseValidityDate(expiry);
  if (!d) return "UNKNOWN";
  return d.getTime() >= Date.now() ? "VALID" : "EXPIRED";
}

export function computeVehicleCompliance(input: {
  rcExpiry?: string | null;
  rcStatus?: string | null;
  insuranceExpiry?: string | null;
  pucExpiry?: string | null;
  fitnessExpiry?: string | null;
}): NormalizedVehicleRc["compliance"] {
  const rc = documentValidity(input.rcExpiry, input.rcStatus);
  const insurance = documentValidity(input.insuranceExpiry);
  const puc = documentValidity(input.pucExpiry);
  const fitness = documentValidity(input.fitnessExpiry);

  const values = [rc, insurance, puc, fitness];
  const hasExpired = values.includes("EXPIRED");
  const allKnownValid = values.every((v) => v === "VALID");
  const allUnknown = values.every((v) => v === "UNKNOWN");

  let overall: VehicleComplianceState = "UNKNOWN";
  if (hasExpired) overall = "NON_COMPLIANT";
  else if (allKnownValid) overall = "VERIFIED";
  else if (!allUnknown && !hasExpired) overall = "UNKNOWN";

  return { rc, insurance, puc, fitness, overall };
}
