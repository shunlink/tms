import type { EwayBillIndentDraft } from "./map-to-indent";
import type { IntegrationVerificationMode } from "../core/verification-status";

export type EwayBillSource = "CLIENT_PROVIDED" | "SHUNLINK_GENERATED" | "MANUAL";
export type EwayBillMode = "EXISTING" | "NONE" | "MANUAL";

export type NormalizedEwayBill = {
  ewayBillNumber: string;
  status: string | null;
  supplierGstin: string | null;
  recipientGstin: string | null;
  documentType: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  goodsDescription: string | null;
  hsnCode: string | null;
  quantity: string | null;
  value: number | null;
  origin: string | null;
  destination: string | null;
  transporterName: string | null;
  transporterGstin: string | null;
  vehicleNumber: string | null;
  validFrom: string | null;
  validUntil: string | null;
  provider: string;
  fetchedAt: string;
  source: EwayBillSource;
  verificationMode?: IntegrationVerificationMode;
};

export type { EwayBillIndentDraft };

/** Provider fetch payload before indent draft mapping (see `fetchEWayBill` in service). */
export type EwayBillProviderFetchResult = {
  data: NormalizedEwayBill;
  /** Decrypted NIC portal payload when fetched via GST API. */
  rawNic?: Record<string, unknown>;
};

export type EwayBillFetchResult = EwayBillProviderFetchResult & {
  indentDraft: EwayBillIndentDraft;
};

export type EwayBillGenerateInput = {
  supplierGstin: string;
  recipientGstin: string;
  documentType: string;
  documentNumber: string;
  documentDate: string;
  goodsDescription: string;
  hsnCode?: string;
  quantity?: string;
  value?: number;
  origin: string;
  destination: string;
  vehicleNumber: string;
  transporterGstin?: string;
};

export type EwayBillGenerateResult = {
  data: NormalizedEwayBill;
};
