"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Landmark, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import type { CompanySettingsFormState } from "@/lib/services/company-settings.service";
import { settingsFieldClass, settingsLabelClass, settingsSectionClass } from "./settings-styles";

const GST_OPTIONS = [
  { value: 18, label: "18% (GTA — Forward Charge)" },
  { value: 5, label: "5% (GTA — No ITC)" },
  { value: 12, label: "12%" },
  { value: 0, label: "Exempt / 0%" },
];

const COMPLIANCE_ITEMS: { key: string; label: string }[] = [
  { key: "vehicleInsurance", label: "Alert 30 days before vehicle insurance expiry" },
  { key: "fitnessCertificate", label: "Alert 30 days before fitness certificate expiry" },
  { key: "pucExpiry", label: "Alert 15 days before PUC expiry" },
  { key: "driverLicense", label: "Alert 30 days before driver license expiry" },
  { key: "clientCreditLimit", label: "Alert when client exceeds credit limit" },
  { key: "podPending", label: "Alert when POD pending more than 7 days" },
];

export default function CompanySettingsForm() {
  const toast = useToast();
  const [form, setForm] = useState<CompanySettingsFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/company");
    if (!res.ok) return;
    setForm((await readJsonBody(res)) as CompanySettingsFormState);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch<K extends keyof CompanySettingsFormState>(key: K, value: CompanySettingsFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function patchCompliance(key: string, checked: boolean) {
    setForm((prev) =>
      prev ? { ...prev, complianceAlerts: { ...prev.complianceAlerts, [key]: checked } } : prev
    );
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, fallback: "Could not save settings" });
        return;
      }
      setForm((data as { settings: CompanySettingsFormState }).settings);
      toast.push({ variant: "success", title: "Company settings saved" });
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return <p className="text-sm text-muted-foreground">Loading company settings…</p>;
  }

  return (
    <div className="space-y-6">
      <Card className={settingsSectionClass}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-lg">Company profile</CardTitle>
          </div>
          <CardDescription>
            Shown on tax invoices, lorry receipts, and payment vouchers. Updates apply to newly generated PDFs.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={settingsLabelClass}>Company name</label>
            <input
              className={settingsFieldClass}
              value={form.companyName}
              onChange={(e) => patch("companyName", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>GSTIN</label>
            <input
              className={settingsFieldClass}
              value={form.gstin}
              onChange={(e) => patch("gstin", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>PAN</label>
            <input
              className={settingsFieldClass}
              value={form.pan}
              onChange={(e) => patch("pan", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className={settingsLabelClass}>Registered address</label>
            <textarea
              className={settingsFieldClass}
              rows={2}
              value={form.registeredAddress}
              onChange={(e) => patch("registeredAddress", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>Accounts email</label>
            <input
              type="email"
              className={settingsFieldClass}
              value={form.accountsEmail}
              onChange={(e) => patch("accountsEmail", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>Contact number</label>
            <input
              className={settingsFieldClass}
              value={form.contactPhone}
              onChange={(e) => patch("contactPhone", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>State / jurisdiction label</label>
            <input
              className={settingsFieldClass}
              placeholder="e.g. Delhi (07)"
              value={form.stateLabel}
              onChange={(e) => patch("stateLabel", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>Default GST % on freight</label>
            <select
              className={settingsFieldClass}
              value={form.defaultFreightGstPercent}
              onChange={(e) => patch("defaultFreightGstPercent", Number(e.target.value))}
            >
              {GST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className={settingsSectionClass}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-lg">Bank details</CardTitle>
          </div>
          <CardDescription>Printed in the bank block on client tax invoices.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={settingsLabelClass}>Bank name</label>
            <input
              className={settingsFieldClass}
              value={form.bankName}
              onChange={(e) => patch("bankName", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>A/C number</label>
            <input
              className={settingsFieldClass}
              value={form.bankAccountNumber}
              onChange={(e) => patch("bankAccountNumber", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>Branch</label>
            <input
              className={settingsFieldClass}
              value={form.bankBranch}
              onChange={(e) => patch("bankBranch", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>IFSC code</label>
            <input
              className={settingsFieldClass}
              value={form.bankIfsc}
              onChange={(e) => patch("bankIfsc", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={settingsSectionClass}>
        <CardHeader>
          <CardTitle className="text-lg">Numbering series</CardTitle>
          <CardDescription>
            Applied to the next LR, invoice, and requirement. Use {"{YYYY}"} for the current year (e.g.
            INV-{"{YYYY}"}- → INV-2026-0001).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={settingsLabelClass}>LR prefix</label>
            <input
              className={settingsFieldClass}
              value={form.lrPrefix ?? "LR-2026-"}
              onChange={(e) => patch("lrPrefix", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>Invoice prefix</label>
            <input
              className={settingsFieldClass}
              value={form.invoicePrefix ?? "INV-2026-"}
              onChange={(e) => patch("invoicePrefix", e.target.value)}
            />
          </div>
          <div>
            <label className={settingsLabelClass}>Requirement prefix</label>
            <input
              className={settingsFieldClass}
              value={form.requirementPrefix ?? "REQ-2026-"}
              onChange={(e) => patch("requirementPrefix", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={settingsSectionClass}>
        <CardHeader>
          <CardTitle className="text-lg">Compliance alerts</CardTitle>
          <CardDescription>Notification preferences (delivery hooks unchanged).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {COMPLIANCE_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300"
                checked={Boolean(form.complianceAlerts[item.key])}
                onChange={(e) => patchCompliance(item.key, e.target.checked)}
              />
              {item.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="bg-slate-900 text-white hover:bg-slate-800"
      >
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving…" : "Save company settings"}
      </Button>
    </div>
  );
}
