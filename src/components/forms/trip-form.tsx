"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";

type Option = { id: string; name: string };
type VehicleOption = { id: string; number: string; type: string };
type DriverOption = { id: string; name: string; phone: string };
type ReqOption = { id: string; reqNumber: string; routeFrom: string; routeTo: string };

export default function TripForm({
  clients,
  vendors,
  vehicles,
  drivers,
  requirements,
  defaults,
}: {
  clients: Option[];
  vendors: Option[];
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  requirements: ReqOption[];
  defaults?: {
    requirementId?: string;
    clientId?: string;
    vendorId?: string;
    vehicleId?: string;
    driverId?: string;
    routeFrom?: string;
    routeTo?: string;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    requirementId: defaults?.requirementId ?? "",
    clientId: defaults?.clientId ?? clients[0]?.id ?? "",
    vendorId: defaults?.vendorId ?? vendors[0]?.id ?? "",
    vehicleId: defaults?.vehicleId ?? vehicles[0]?.id ?? "",
    driverId: defaults?.driverId ?? drivers[0]?.id ?? "",
    routeFrom: defaults?.routeFrom ?? "",
    routeTo: defaults?.routeTo ?? "",
    cargoDetails: "",
    clientRate: "",
    vendorRate: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const margin =
    form.clientRate && form.vendorRate
      ? Number(form.clientRate) - Number(form.vendorRate)
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create trip");
      return;
    }
    router.push("/trips");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Route & Cargo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Link Requirement (optional)</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.requirementId}
              onChange={(e) => set("requirementId", e.target.value)}
            >
              <option value="">— None —</option>
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.reqNumber} · {r.routeFrom} → {r.routeTo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From (Origin) *</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={form.routeFrom}
              onChange={(e) => set("routeFrom", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To (Destination) *</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={form.routeTo}
              onChange={(e) => set("routeTo", e.target.value)}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Cargo Details</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm"
              rows={2}
              value={form.cargoDetails}
              onChange={(e) => set("cargoDetails", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client & Rate</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client *</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.clientId}
              onChange={(e) => set("clientId", e.target.value)}
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client Freight (₹) *</label>
            <input
              type="number"
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={form.clientRate}
              onChange={(e) => set("clientRate", e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendor, Vehicle & Driver</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vendor *</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.vendorId}
              onChange={(e) => set("vendorId", e.target.value)}
              required
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Freight (₹) *</label>
            <input
              type="number"
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={form.vendorRate}
              onChange={(e) => set("vendorRate", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle *</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.vehicleId}
              onChange={(e) => set("vehicleId", e.target.value)}
              required
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.number} · {v.type.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Driver</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.driverId}
              onChange={(e) => set("driverId", e.target.value)}
            >
              <option value="">— None —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name} · {d.phone}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {margin !== null && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 flex items-center justify-between">
            <p className="text-sm font-medium text-green-800">Your Margin on this trip</p>
            <p className="text-2xl font-bold text-green-700">{formatINR(margin)}</p>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create Trip & Generate LR"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
