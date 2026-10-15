import type {
  IntegrationVerificationMode,
  VerificationStatus,
} from "../core/verification-status";

export type NormalizedDrivingLicence = {
  dlNumber: string;
  name: string | null;
  status: string | null;
  issueDate: string | null;
  validity: string | null;
  expiryDate: string | null;
  dateOfBirth: string | null;
  vehicleClasses: string[];
  address: string | null;
  state: string | null;
  provider: string;
  verifiedAt: string;
  verificationStatus: VerificationStatus;
  verificationMode?: IntegrationVerificationMode;
};

export type DlVerifyResult = {
  valid: boolean;
  data: NormalizedDrivingLicence;
};
