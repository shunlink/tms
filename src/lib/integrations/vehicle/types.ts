import type {
  IntegrationVerificationMode,
  VerificationStatus,
} from "../core/verification-status";

export type DocumentValidity = "VALID" | "EXPIRED" | "UNKNOWN";
export type VehicleComplianceState = "VERIFIED" | "NON_COMPLIANT" | "UNKNOWN";

export type NormalizedVehicleRc = {
  registrationNumber: string;
  ownerName: string | null;
  make: string | null;
  model: string | null;
  vehicleClass: string | null;
  fuelType: string | null;
  registrationDate: string | null;
  rcStatus: string | null;
  rcExpiry: string | null;
  fitnessExpiry: string | null;
  insuranceCompany: string | null;
  insuranceNumber: string | null;
  insuranceExpiry: string | null;
  pucNumber: string | null;
  pucExpiry: string | null;
  permitType: string | null;
  permitNumber: string | null;
  permitExpiry: string | null;
  financer: string | null;
  provider: string;
  verifiedAt: string;
  verificationStatus: VerificationStatus;
  verificationMode?: IntegrationVerificationMode;
  compliance: {
    rc: DocumentValidity;
    insurance: DocumentValidity;
    puc: DocumentValidity;
    fitness: DocumentValidity;
    overall: VehicleComplianceState;
  };
};

export type VehicleRcVerifyResult = {
  valid: boolean;
  data: NormalizedVehicleRc;
};
