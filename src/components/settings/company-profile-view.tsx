"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Hash,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readJsonBody } from "@/lib/api-client";
import { applyYearTokens, exampleDocumentNumber } from "@/lib/document-number";
import type { CompanySettingsFormState } from "@/lib/services/company-settings.service";
import { settingsSectionClass } from "./settings-styles";

const COMPLIANCE_LABELS: Record<string, string> = {
  vehicleInsurance: "Vehicle insurance expiry",
  fitnessCertificate: "Fitness certificate expiry",
  pucExpiry: "PUC expiry",
  driverLicense: "Driver license expiry",
  clientCreditLimit: "Client credit limit",
  podPending: "POD pending > 7 days",
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900 break-words">{value || "—"}</p>
    </div>
  );
}

export default function CompanyProfileView() {
  const [data, setData] = useState<CompanySettingsFormState | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/company");
    if (!res.ok) return;
    setData((await readJsonBody(res)) as CompanySettingsFormState);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading company profile…</p>;
  }

  const year = new Date().getFullYear();
  const lrTemplate = applyYearTokens(data.lrPrefix ?? `LR-${year}-`, year);
  const invTemplate = applyYearTokens(data.invoicePrefix ?? `INV-${year}-`, year);
  const reqTemplate = applyYearTokens(data.requirementPrefix ?? `REQ-${year}-`, year);
  const enabledAlerts = Object.entries(data.complianceAlerts).filter(([, on]) => on);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200/80 shadow-sm">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-8 text-white">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-300">Organization</p>
              <h2 className="text-2xl font-bold tracking-tight mt-1">{data.companyName || "—"}</h2>
              {data.stateLabel && (
                <p className="text-sm text-slate-300 mt-2 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {data.stateLabel}
                </p>
              )}
            </div>
          </div>
        </div>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Detail label="Registered address" value={data.registeredAddress} />
          <Detail label="GSTIN" value={data.gstin} />
          <Detail label="PAN" value={data.pan} />
          <Detail label="Default GST on freight" value={`${data.defaultFreightGstPercent}%`} />
          <Detail label="Accounts email" value={data.accountsEmail} />
          <Detail label="Contact number" value={data.contactPhone} />
        </CardContent>
      </Card>

      <Card className={settingsSectionClass}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-lg">Bank details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Detail label="Bank name" value={data.bankName} />
          <Detail label="Account number" value={data.bankAccountNumber} />
          <Detail label="Branch" value={data.bankBranch} />
          <Detail label="IFSC" value={data.bankIfsc} />
        </CardContent>
      </Card>

      <Card className={settingsSectionClass}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-lg">Document numbering</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            New LR, invoices, and requirements use these prefixes (4-digit sequence).
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Lorry receipt (LR)", template: lrTemplate },
            { label: "Tax invoice", template: invTemplate },
            { label: "Client requirement", template: reqTemplate },
          ].map((row) => (
            <div
              key={row.label}
              className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3"
            >
              <p className="text-xs font-semibold text-slate-500">{row.label}</p>
              <p className="mt-2 font-mono text-sm text-slate-900">{exampleDocumentNumber(row.template, 1)}</p>
              <p className="text-[11px] text-slate-500 mt-1">Prefix: {row.template}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className={settingsSectionClass}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-lg">Compliance alerts</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {enabledAlerts.length === 0 && (
            <p className="text-sm text-muted-foreground">No alert rules enabled.</p>
          )}
          {enabledAlerts.map(([key]) => (
            <span
              key={key}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
            >
              {COMPLIANCE_LABELS[key] ?? key}
            </span>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <Mail className="h-3.5 w-3.5" />
        <Phone className="h-3.5 w-3.5" />
        Letterhead on PDFs uses this profile. Contact Super Admin to request changes.
      </p>
    </div>
  );
}
