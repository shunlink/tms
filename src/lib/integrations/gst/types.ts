import type {
  IntegrationVerificationMode,
  VerificationStatus,
} from "../core/verification-status";

export type GstVerificationStatus = VerificationStatus;

export type NormalizedGstData = {
  gstin: string;
  legalName: string | null;
  tradeName: string | null;
  status: string | null;
  registrationDate: string | null;
  constitution: string | null;
  taxpayerType: string | null;
  principalAddress: string | null;
  state: string | null;
  city: string | null;
  pincode: string | null;
  pan: string | null;
  stateJurisdiction: string | null;
  centerJurisdiction: string | null;
  businessActivities: string[];
  provider: string;
  verifiedAt: string;
  verificationStatus: GstVerificationStatus;
  verificationMode?: IntegrationVerificationMode;
};

export type GstVerifyResult = {
  valid: boolean;
  data: NormalizedGstData;
};
