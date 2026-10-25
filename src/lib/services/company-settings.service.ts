import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  applyYearTokens,
  defaultNumberPrefixTemplate,
  type ConfigurableNumberKind,
} from "../document-number";
import { DEFAULT_COMPANY_PROFILE, mapCompanySettingsToProfile, type CompanyProfile } from "../company";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";

export const COMPANY_SETTINGS_ID = "default";

export type CompanySettingsDto = {
  companyName: string;
  logoPath: string;
  registeredAddress: string;
  gstin: string;
  pan: string;
  defaultFreightGstPercent: number;
  accountsEmail: string;
  contactPhone: string;
  stateLabel: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranch: string;
  bankIfsc: string;
  lrPrefix: string | null;
  invoicePrefix: string | null;
  requirementPrefix: string | null;
};

export type CompanySettingsFormState = CompanySettingsDto & {
  complianceAlerts: Record<string, boolean>;
};

const DEFAULT_COMPLIANCE_ALERTS: Record<string, boolean> = {
  vehicleInsurance: true,
  fitnessCertificate: true,
  pucExpiry: true,
  driverLicense: true,
  clientCreditLimit: true,
  podPending: true,
};

function n(v: { toNumber(): number } | number | null | undefined) {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

function emptyToDefault(row: Awaited<ReturnType<typeof getCompanySettingsRecord>>) {
  const hasAny =
    row.companyName ||
    row.gstin ||
    row.registeredAddress ||
    row.bankName;
  if (hasAny) return row;
  return {
    ...row,
    companyName: DEFAULT_COMPANY_PROFILE.name,
    logoPath: DEFAULT_COMPANY_PROFILE.logoPath,
    registeredAddress: DEFAULT_COMPANY_PROFILE.address,
    gstin: DEFAULT_COMPANY_PROFILE.gstin,
    pan: DEFAULT_COMPANY_PROFILE.pan,
    accountsEmail: DEFAULT_COMPANY_PROFILE.email,
    contactPhone: DEFAULT_COMPANY_PROFILE.phone,
    stateLabel: DEFAULT_COMPANY_PROFILE.state,
    bankName: DEFAULT_COMPANY_PROFILE.bankName,
    bankAccountNumber: DEFAULT_COMPANY_PROFILE.bankAccount,
    bankBranch: DEFAULT_COMPANY_PROFILE.bankBranch,
    bankIfsc: DEFAULT_COMPANY_PROFILE.bankIfsc,
    defaultFreightGstPercent: DEFAULT_COMPANY_PROFILE.defaultFreightGstPercent,
  };
}

export async function getCompanySettingsRecord() {
  return prisma.companySettings.upsert({
    where: { id: COMPANY_SETTINGS_ID },
    create: { id: COMPANY_SETTINGS_ID },
    update: {},
  });
}

export async function getCompanySettingsFormState(): Promise<CompanySettingsFormState> {
  const row = emptyToDefault(await getCompanySettingsRecord());
  const compliance =
    row.complianceAlertsJson && typeof row.complianceAlertsJson === "object"
      ? { ...DEFAULT_COMPLIANCE_ALERTS, ...(row.complianceAlertsJson as Record<string, boolean>) }
      : { ...DEFAULT_COMPLIANCE_ALERTS };

  return {
    companyName: row.companyName,
    logoPath: row.logoPath,
    registeredAddress: row.registeredAddress,
    gstin: row.gstin,
    pan: row.pan,
    defaultFreightGstPercent: n(row.defaultFreightGstPercent),
    accountsEmail: row.accountsEmail,
    contactPhone: row.contactPhone,
    stateLabel: row.stateLabel,
    bankName: row.bankName,
    bankAccountNumber: row.bankAccountNumber,
    bankBranch: row.bankBranch,
    bankIfsc: row.bankIfsc,
    lrPrefix: row.lrPrefix,
    invoicePrefix: row.invoicePrefix,
    requirementPrefix: row.requirementPrefix,
    complianceAlerts: compliance,
  };
}

export async function updateCompanySettings(
  input: Partial<CompanySettingsFormState>,
  actor?: SessionUser | null
): Promise<CompanyProfile> {
  const data: Prisma.CompanySettingsUpdateInput = {};

  if (input.companyName !== undefined) data.companyName = input.companyName.trim();
  if (input.logoPath !== undefined) data.logoPath = input.logoPath.trim() || "brand/logo-light.svg";
  if (input.registeredAddress !== undefined) data.registeredAddress = input.registeredAddress.trim();
  if (input.gstin !== undefined) data.gstin = input.gstin.trim().toUpperCase();
  if (input.pan !== undefined) data.pan = input.pan.trim().toUpperCase();
  if (input.defaultFreightGstPercent !== undefined) {
    data.defaultFreightGstPercent = input.defaultFreightGstPercent;
  }
  if (input.accountsEmail !== undefined) data.accountsEmail = input.accountsEmail.trim();
  if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone.trim();
  if (input.stateLabel !== undefined) data.stateLabel = input.stateLabel.trim();
  if (input.bankName !== undefined) data.bankName = input.bankName.trim();
  if (input.bankAccountNumber !== undefined) data.bankAccountNumber = input.bankAccountNumber.trim();
  if (input.bankBranch !== undefined) data.bankBranch = input.bankBranch.trim();
  if (input.bankIfsc !== undefined) data.bankIfsc = input.bankIfsc.trim().toUpperCase();
  if (input.lrPrefix !== undefined) data.lrPrefix = input.lrPrefix?.trim() || null;
  if (input.invoicePrefix !== undefined) data.invoicePrefix = input.invoicePrefix?.trim() || null;
  if (input.requirementPrefix !== undefined) data.requirementPrefix = input.requirementPrefix?.trim() || null;
  if (input.complianceAlerts !== undefined) data.complianceAlertsJson = input.complianceAlerts;

  if (actor?.id) data.updatedById = actor.id;

  await getCompanySettingsRecord();
  const row = await prisma.companySettings.update({
    where: { id: COMPANY_SETTINGS_ID },
    data,
  });

  await logAudit({
    user: actor,
    action: "company_settings.updated",
    entity: "CompanySettings",
    entityId: row.id,
    meta: { fields: Object.keys(input) },
  }).catch(() => {});

  return mapCompanySettingsToProfile(row);
}

/** Resolved prefix template for the next LR / invoice / requirement number. */
export async function getNumberingPrefixTemplate(kind: ConfigurableNumberKind): Promise<string> {
  const row = await getCompanySettingsRecord();
  const year = new Date().getFullYear();
  const stored =
    kind === "INV"
      ? row.invoicePrefix
      : kind === "LR"
        ? row.lrPrefix
        : row.requirementPrefix;
  const template = stored?.trim() || defaultNumberPrefixTemplate(kind, year);
  return applyYearTokens(template, year);
}
