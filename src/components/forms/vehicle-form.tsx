"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceBadges } from "@/components/integrations/compliance-badges";
import { Loader2 } from "lucide-react";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

const vehicleTypes: [string, string][] = [
  ["TEMPO_8FT", "Tempo 8ft"],
  ["TEMPO_14FT", "Tempo 14ft"],
  ["TRUCK_17FT", "Truck 17ft"],
  ["TRUCK_19FT", "Truck 19ft"],
  ["TRUCK_20FT", "Truck 20ft"],
  ["TRUCK_22FT", "Truck 22ft"],
  ["TRUCK_32FT_SINGLE", "32ft Single Axle"],
  ["TRUCK_32FT_MULTI", "32ft Multi Axle"],
  ["CONTAINER_20FT", "Container 20ft"],
  ["CONTAINER_40FT", "Container 40ft"],
  ["TANKER", "Tanker"],
  ["TRAILER", "Trailer"],
];

const FIELDS = [
  "registrationNumber", "type", "bodyType", "capacity", "capacityTons", "make", "model", "year", "ownership",
  "rcNumber", "rcExpiry", "ownerName", "ownerPan",
  "insuranceNumber", "insuranceCompany", "insuranceExpiry", "insuranceValue",
  "fitnessExpiry", "pucNumber", "pucExpiry",
  "permitType", "permitNumber", "permitExpiry",
  "gpsDeviceId", "fastagId", "remarks",
] as const;

type Field = (typeof FIELDS)[number];

export default function VehicleForm({
  vendors,
  initial,
  vehicleId,
}: {
  vendors: { id: string; name: string }[];
  initial?: Partial<Record<Field, string>> & {
    vendorId?: string;
    gpsEnabled?: boolean;
    rcVerified?: boolean;
    rcVerificationProvider?: string | null;
    rcVerificationStatus?: string | null;
    rcVerifiedAt?: string | null;
    compliance?: {
      rc?: "VALID" | "EXPIRED" | "UNKNOWN";
      insurance?: "VALID" | "EXPIRED" | "UNKNOWN";
      puc?: "VALID" | "EXPIRED" | "UNKNOWN";
      fitness?: "VALID" | "EXPIRED" | "UNKNOWN";
    };
  };
  vehicleId?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState<Record<Field, string>>(() => {
    const base = {} as Record<Field, string>;
    for (const f of FIELDS) base[f] = initial?.[f] ?? "";
    if (!base.type) base.type = "TRUCK_17FT";
    if (!base.ownership) base.ownership = "ATTACHED";
    return base;
  });
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? vendors[0]?.id ?? "");
  const [gpsEnabled, setGpsEnabled] = useState(initial?.gpsEnabled ?? false);
  const [error, setError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [compliance, setCompliance] = useState(initial?.compliance ?? null);
  const [rcMeta, setRcMeta] = useState({
    verified: initial?.rcVerified ?? false,
    provider: initial?.rcVerificationProvider ?? null,
    verifiedAt: initial?.rcVerifiedAt ?? null,
    verificationStatus: initial?.rcVerificationStatus ?? null,
  });
  const set = (k: Field, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function verifyRc(reVerify = false) {
    setVerifyError("");
    if (!form.registrationNumber.trim()) {
      setVerifyError("Enter vehicle registration number");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/integrations/vehicle/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: form.registrationNumber.trim(),
          vehicleId,
          persist: Boolean(vehicleId),
        }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError: setVerifyError, fallback: "Vehicle verification failed" });
        return;
      }
      const d = (data as { data: Record<string, unknown> }).data;
      const c = d.compliance as Record<string, string> | undefined;
      setCompliance(
        c
          ? {
              rc: c.rc as "VALID" | "EXPIRED" | "UNKNOWN",
              insurance: c.insurance as "VALID" | "EXPIRED" | "UNKNOWN",
              puc: c.puc as "VALID" | "EXPIRED" | "UNKNOWN",
              fitness: c.fitness as "VALID" | "EXPIRED" | "UNKNOWN",
            }
          : null
      );
      setRcMeta({
        verified: true,
        provider: String(d.provider ?? ""),
        verifiedAt: String(d.verifiedAt ?? new Date().toISOString()),
        verificationStatus: String(d.verificationStatus ?? "VERIFIED"),
      });
      setForm((f) => ({
        ...f,
        registrationNumber: String(d.registrationNumber ?? f.registrationNumber),
        rcNumber: String(d.registrationNumber ?? f.rcNumber),
        ownerName: String(d.ownerName ?? f.ownerName),
        make: String(d.make ?? f.make),
        model: String(d.model ?? f.model),
        rcExpiry: String(d.rcExpiry ?? f.rcExpiry).slice(0, 10),
        insuranceCompany: String(d.insuranceCompany ?? f.insuranceCompany),
        insuranceNumber: String(d.insuranceNumber ?? f.insuranceNumber),
        insuranceExpiry: String(d.insuranceExpiry ?? f.insuranceExpiry).slice(0, 10),
        fitnessExpiry: String(d.fitnessExpiry ?? f.fitnessExpiry).slice(0, 10),
        pucNumber: String(d.pucNumber ?? f.pucNumber),
        pucExpiry: String(d.pucExpiry ?? f.pucExpiry).slice(0, 10),
        permitType: String(d.permitType ?? f.permitType),
        permitNumber: String(d.permitNumber ?? f.permitNumber),
        permitExpiry: String(d.permitExpiry ?? f.permitExpiry).slice(0, 10),
      }));
      if (reVerify) setVerifyError("");
    } finally {
      setVerifying(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(vehicleId ? `/api/vehicles/${vehicleId}` : "/api/vehicles", {
      method: vehicleId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        number: form.registrationNumber,
        vendorId,
        gpsEnabled,
      }),
    });
    setSaving(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to save vehicle" });
      return;
    }
    const saved = data as { id?: string };
    router.push(`/vehicles/${vehicleId ?? saved.id}`);
    router.refresh();
  }

  const input = (k: Field, label: string, type = "text") => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type={type} className="w-full border rounded-md px-3 py-2 text-sm" value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Vehicle</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Number *</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                value={form.registrationNumber}
                onChange={(e) => set("registrationNumber", e.target.value.toUpperCase())}
                placeholder="MH12AB1234"
                required
              />
              <Button type="button" variant="outline" disabled={verifying} onClick={() => verifyRc(rcMeta.verified)}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : rcMeta.verified ? "Re-verify" : "Verify & Fetch Details"}
              </Button>
            </div>
            {compliance && <ComplianceBadges {...compliance} />}
            {rcMeta.verified && (
              <p className="text-xs text-slate-500">
                {rcMeta.verificationStatus === "MOCK" ? "Mock verification" : "RC verified"} · Provider:{" "}
                {rcMeta.provider ?? "—"} ·{" "}
                {rcMeta.verifiedAt ? new Date(rcMeta.verifiedAt).toLocaleString() : "—"}
              </p>
            )}
            {verifyError && <p className="text-xs text-red-600">{verifyError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Owner (Vendor) *</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type *</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.type} onChange={(e) => set("type", e.target.value)}>
              {vehicleTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Body Type</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.bodyType} onChange={(e) => set("bodyType", e.target.value)}>
              <option value="">— Select —</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Container">Container</option>
              <option value="Flatbed">Flatbed</option>
              <option value="Tanker">Tanker</option>
            </select>
          </div>
          {input("make", "Make")}
          {input("model", "Model")}
          {input("year", "Year", "number")}
          {input("capacity", "Capacity (e.g. 18 MT)")}
          {input("capacityTons", "Capacity (tons)", "number")}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ownership</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.ownership} onChange={(e) => set("ownership", e.target.value)}>
              <option value="OWNED">Owned</option>
              <option value="ATTACHED">Attached</option>
              <option value="MARKET">Market</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Registration</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("rcNumber", "RC Number")}
          {input("rcExpiry", "RC Expiry", "date")}
          {input("ownerName", "Registered Owner Name")}
          {input("ownerPan", "Owner PAN")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Insurance</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("insuranceNumber", "Policy Number")}
          {input("insuranceCompany", "Insurance Company")}
          {input("insuranceExpiry", "Insurance Expiry", "date")}
          {input("insuranceValue", "IDV (₹)", "number")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Fitness, PUC & Permit</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("fitnessExpiry", "Fitness Expiry", "date")}
          {input("pucNumber", "PUC Number")}
          {input("pucExpiry", "PUC Expiry", "date")}
          {input("permitType", "Permit Type")}
          {input("permitNumber", "Permit Number")}
          {input("permitExpiry", "Permit Expiry", "date")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Telematics</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={gpsEnabled} onChange={(e) => setGpsEnabled(e.target.checked)} />
            GPS enabled
          </label>
          {input("gpsDeviceId", "GPS Device ID")}
          {input("fastagId", "FASTag ID")}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : vehicleId ? "Update Vehicle" : "Save Vehicle"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
