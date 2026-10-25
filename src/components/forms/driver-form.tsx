"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { parseApiError } from "@/lib/toast-utils";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

export default function DriverForm({
  driverId,
  initial,
}: {
  driverId?: string;
  initial?: {
    name?: string;
    phone?: string;
    dlNumber?: string;
    dlExpiry?: string;
    dateOfBirth?: string;
    address?: string;
    dlVerified?: boolean;
    dlVerificationProvider?: string | null;
    dlVerificationStatus?: string | null;
    dlVerifiedAt?: string | null;
    dlStatus?: string | null;
    dlVehicleClasses?: string | null;
  };
}) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    dlNumber: initial?.dlNumber ?? "",
    dlExpiry: initial?.dlExpiry ?? "",
    dateOfBirth: initial?.dateOfBirth ?? "",
    address: initial?.address ?? "",
  });
  const [error, setError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dlMeta, setDlMeta] = useState({
    verified: initial?.dlVerified ?? false,
    provider: initial?.dlVerificationProvider ?? null,
    verifiedAt: initial?.dlVerifiedAt ?? null,
    status: initial?.dlStatus ?? null,
    classes: initial?.dlVehicleClasses ?? null,
    verificationStatus: initial?.dlVerificationStatus ?? null,
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function verifyDl(reVerify = false) {
    setVerifyError("");
    if (!form.dlNumber.trim()) {
      setVerifyError("Enter DL number");
      return;
    }
    if (!form.dateOfBirth.trim()) {
      setVerifyError("Date of birth is required for DL verification");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/integrations/dl/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dlNumber: form.dlNumber.trim(),
          dateOfBirth: form.dateOfBirth,
          driverId,
          persist: Boolean(driverId),
        }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError: setVerifyError, fallback: "DL verification failed" });
        return;
      }
      const d = (data as { data: Record<string, unknown> }).data;
      setDlMeta({
        verified: true,
        provider: String(d.provider ?? ""),
        verifiedAt: String(d.verifiedAt ?? new Date().toISOString()),
        status: String(d.status ?? ""),
        classes: Array.isArray(d.vehicleClasses)
          ? (d.vehicleClasses as string[]).join(", ")
          : String(d.vehicleClasses ?? ""),
        verificationStatus: String(d.verificationStatus ?? "VERIFIED"),
      });
      setForm((f) => ({
        ...f,
        name: String(d.name ?? f.name),
        dlNumber: String(d.dlNumber ?? f.dlNumber),
        dlExpiry: String(d.expiryDate ?? d.validity ?? f.dlExpiry).slice(0, 10),
        dateOfBirth: String(d.dateOfBirth ?? f.dateOfBirth).slice(0, 10),
        address: String(d.address ?? f.address),
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
    const res = await fetch(driverId ? `/api/drivers/${driverId}` : "/api/drivers", {
      method: driverId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to save driver" });
      return;
    }
    router.push("/drivers");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Driver Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">DL Number *</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.dlNumber} onChange={(e) => set("dlNumber", e.target.value.toUpperCase())} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth *</label>
            <input type="date" className="w-full border rounded-md px-3 py-2 text-sm" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} required />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="button" variant="outline" disabled={verifying} onClick={() => verifyDl(dlMeta.verified)}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : dlMeta.verified ? "Re-verify DL" : "Verify DL"}
            </Button>
            {dlMeta.verified && (
              <div className="text-xs text-slate-600">
                <span className="font-medium text-emerald-700">
                  {dlMeta.verificationStatus === "MOCK" ? "Mock verification" : "Verified"}
                </span>
                {dlMeta.status && ` · DL Status: ${dlMeta.status}`}
                {dlMeta.classes && ` · Classes: ${dlMeta.classes}`}
                {dlMeta.provider && ` · Provider: ${dlMeta.provider}`}
              </div>
            )}
          </div>
          {verifyError && <p className="md:col-span-2 text-xs text-red-600">{verifyError}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">DL Expiry</label>
            <input type="date" className="w-full border rounded-md px-3 py-2 text-sm" value={form.dlExpiry} onChange={(e) => set("dlExpiry", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          <div className="md:col-span-2 flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Driver"}</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
