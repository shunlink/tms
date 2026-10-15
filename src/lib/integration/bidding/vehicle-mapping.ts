import { BiddingIntegrationError } from "./errors";

/** TMS `IndentConsignment.vehicleTypeCode` values used in the product UI. */
export const TMS_VEHICLE_TYPE_CODES = [
  "TEMPO_14FT",
  "TRUCK_17FT",
  "TRUCK_20FT",
  "TRUCK_22FT",
  "TRUCK_32FT_SINGLE",
  "TRUCK_32FT_MULTI",
  "CONTAINER_20FT",
  "CONTAINER_40FT",
  "TANKER",
  "TRAILER",
] as const;

/** Common aliases Bidding may send instead of canonical TMS codes. */
const VEHICLE_TYPE_ALIASES: Record<string, (typeof TMS_VEHICLE_TYPE_CODES)[number]> = {
  TRUCK_32FT: "TRUCK_32FT_MULTI",
  TRUCK_32FT_MULTI_AXLE: "TRUCK_32FT_MULTI",
  CONTAINER: "CONTAINER_20FT",
};

/** Bidding load vehicle category → TMS vehicle + body (when body not supplied). */
export const BIDDING_VEHICLE_CATEGORY_MAP: Record<
  string,
  { vehicleTypeCode: (typeof TMS_VEHICLE_TYPE_CODES)[number]; bodyTypeCode: string | null }
> = {
  OPEN_BODY: { vehicleTypeCode: "TRUCK_32FT_MULTI", bodyTypeCode: "OPEN" },
  CONTAINER: { vehicleTypeCode: "CONTAINER_20FT", bodyTypeCode: "CLOSED" },
  TRAILER: { vehicleTypeCode: "TRAILER", bodyTypeCode: "OPEN" },
  TANKER: { vehicleTypeCode: "TANKER", bodyTypeCode: "Tanker" },
  REFRIGERATED: { vehicleTypeCode: "TRUCK_32FT_MULTI", bodyTypeCode: "Closed" },
  OTHER: { vehicleTypeCode: "TRUCK_17FT", bodyTypeCode: null },
};

export const TMS_BODY_TYPE_CODES = [
  "OPEN",
  "CLOSED",
  "Open",
  "Closed",
  "Container",
  "Flatbed",
  "Tanker",
] as const;

const ALLOWED_WEIGHT_UNITS = new Set(["MT", "KG"]);

export type ResolvedAwardCargo = {
  vehicleTypeCode: string;
  bodyTypeCode: string | null;
  weightUnit: string;
  cargoTypeCode: string;
};

function normalizeVehicleCode(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return VEHICLE_TYPE_ALIASES[upper] ?? upper;
}

function isKnownTmsVehicle(code: string): boolean {
  const normalized = normalizeVehicleCode(code);
  return (TMS_VEHICLE_TYPE_CODES as readonly string[]).includes(normalized);
}

export function resolveAwardCargo(cargo: {
  vehicleTypeCode?: string | null;
  vehicleCategory?: string | null;
  bodyTypeCode?: string | null;
  weightUnit?: string | null;
  cargoTypeCode?: string | null;
}): ResolvedAwardCargo {
  const weightUnit = (cargo.weightUnit ?? "MT").toUpperCase();
  if (!ALLOWED_WEIGHT_UNITS.has(weightUnit)) {
    throw new BiddingIntegrationError(
      `weightUnit must be MT or KG (got ${cargo.weightUnit})`,
      "VALIDATION_ERROR",
      400,
      { field: "cargo.weightUnit" }
    );
  }

  const categoryRaw = cargo.vehicleCategory?.trim().toUpperCase();
  const typeRaw = cargo.vehicleTypeCode?.trim() ?? "";

  let vehicleTypeCode: string;
  let bodyTypeCode: string | null = cargo.bodyTypeCode?.trim() || null;

  if (categoryRaw && BIDDING_VEHICLE_CATEGORY_MAP[categoryRaw]) {
    const mapped = BIDDING_VEHICLE_CATEGORY_MAP[categoryRaw];
    vehicleTypeCode = mapped.vehicleTypeCode;
    if (!bodyTypeCode) bodyTypeCode = mapped.bodyTypeCode;
  } else if (typeRaw && BIDDING_VEHICLE_CATEGORY_MAP[typeRaw.toUpperCase()]) {
    const mapped = BIDDING_VEHICLE_CATEGORY_MAP[typeRaw.toUpperCase()];
    vehicleTypeCode = mapped.vehicleTypeCode;
    if (!bodyTypeCode) bodyTypeCode = mapped.bodyTypeCode;
  } else if (typeRaw) {
    const normalized = normalizeVehicleCode(typeRaw);
    if (!isKnownTmsVehicle(normalized)) {
      throw new BiddingIntegrationError(
        `Unknown vehicleTypeCode "${cargo.vehicleTypeCode}". Send a TMS code (${TMS_VEHICLE_TYPE_CODES.join(", ")}) or a Bidding category (${Object.keys(BIDDING_VEHICLE_CATEGORY_MAP).join(", ")}).`,
        "VALIDATION_ERROR",
        400,
        { field: "cargo.vehicleTypeCode", allowedTmsCodes: TMS_VEHICLE_TYPE_CODES }
      );
    }
    vehicleTypeCode = normalized;
  } else {
    vehicleTypeCode = BIDDING_VEHICLE_CATEGORY_MAP.OTHER.vehicleTypeCode;
  }

  if (bodyTypeCode && !(TMS_BODY_TYPE_CODES as readonly string[]).includes(bodyTypeCode)) {
    throw new BiddingIntegrationError(
      `Unknown bodyTypeCode "${bodyTypeCode}"`,
      "VALIDATION_ERROR",
      400,
      { field: "cargo.bodyTypeCode", allowedBodyTypes: TMS_BODY_TYPE_CODES }
    );
  }

  const cargoTypeCode = cargo.cargoTypeCode?.trim() || "GENERAL";

  return {
    vehicleTypeCode,
    bodyTypeCode,
    weightUnit,
    cargoTypeCode,
  };
}
