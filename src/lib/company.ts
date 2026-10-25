import type { CompanySettings } from "@prisma/client";

/** Letterhead + bank block used on LR, tax invoices, and payment vouchers. */
export type CompanyProfile = {
  name: string;
  logoPath: string;
  address: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  state: string;
  bankName: string;
  bankAccount: string;
  bankBranch: string;
  bankIfsc: string;
  defaultFreightGstPercent: number;
};

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "Shunlink Logistics Pvt. Ltd.",
  logoPath: "brand/logo-light.svg",
  address: "Plot 12, Transport Nagar, New Delhi - 110042",
  gstin: "07AAAAA0000A1Z5",
  pan: "AAAAA0000A",
  phone: "+91 98765 43210",
  email: "accounts@yourtransport.in",
  state: "Delhi (07)",
  bankName: "State Bank of India",
  bankAccount: "30212345678",
  bankBranch: "Transport Nagar, New Delhi",
  bankIfsc: "SBIN0001234",
  defaultFreightGstPercent: 18,
};

/** @deprecated Use getCompanyProfile() — kept for type re-exports during migration */
export const companyProfile = DEFAULT_COMPANY_PROFILE;

export function mapCompanySettingsToProfile(row: CompanySettings): CompanyProfile {
  const gstPercent = Number(row.defaultFreightGstPercent);
  return {
    name: row.companyName || DEFAULT_COMPANY_PROFILE.name,
    logoPath: row.logoPath || DEFAULT_COMPANY_PROFILE.logoPath,
    address: row.registeredAddress || DEFAULT_COMPANY_PROFILE.address,
    gstin: row.gstin || DEFAULT_COMPANY_PROFILE.gstin,
    pan: row.pan || DEFAULT_COMPANY_PROFILE.pan,
    phone: row.contactPhone || DEFAULT_COMPANY_PROFILE.phone,
    email: row.accountsEmail || DEFAULT_COMPANY_PROFILE.email,
    state: row.stateLabel || DEFAULT_COMPANY_PROFILE.state,
    bankName: row.bankName || DEFAULT_COMPANY_PROFILE.bankName,
    bankAccount: row.bankAccountNumber || DEFAULT_COMPANY_PROFILE.bankAccount,
    bankBranch: row.bankBranch || DEFAULT_COMPANY_PROFILE.bankBranch,
    bankIfsc: row.bankIfsc || DEFAULT_COMPANY_PROFILE.bankIfsc,
    defaultFreightGstPercent: Number.isFinite(gstPercent) ? gstPercent : 18,
  };
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const { getCompanySettingsRecord } = await import("./services/company-settings.service");
  const row = await getCompanySettingsRecord();
  return mapCompanySettingsToProfile(row);
}
