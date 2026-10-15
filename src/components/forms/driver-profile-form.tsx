"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Field = "name" | "phone" | "dlNumber" | "dlExpiry" | "address" | "city" | "state" | "pincode";

export default function DriverProfileForm({
  initial,
}: {
  initial?: Partial<Record<Field, string>>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Record<Field, string>>({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    dlNumber: initial?.dlNumber ?? "",
    dlExpiry: initial?.dlExpiry ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    pincode: initial?.pincode ?? "",
  });
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: Field, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOkMsg("");
    setSaving(true);
    const res = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save profile");
      return;
    }
    setOkMsg("Profile updated");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Details</CardTitle>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">DL Number</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.dlNumber} onChange={(e) => set("dlNumber", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">DL Expiry</label>
            <input type="date" className="w-full border rounded-md px-3 py-2 text-sm" value={form.dlExpiry} onChange={(e) => set("dlExpiry", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.state} onChange={(e) => set("state", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
          </div>
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          {okMsg && <p className="md:col-span-2 text-sm text-green-600">{okMsg}</p>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
