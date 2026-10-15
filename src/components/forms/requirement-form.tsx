"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const vehicleTypes: [string, string][] = [
  ["TEMPO_14FT", "Tempo 14ft"],
  ["TRUCK_17FT", "Truck 17ft"],
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
  "routeFrom", "routeTo", "expectedDate",
  "consignorName", "consignorAddress", "consignorCity", "consignorState", "consignorPincode", "consignorContact", "consignorPhone", "pickupDate", "pickupTime",
  "consigneeName", "consigneeAddress", "consigneeCity", "consigneeState", "consigneePincode", "consigneeContact", "consigneePhone", "deliveryDate", "deliveryTime",
  "serviceType", "transactionType", "vehicleType", "bodyType", "quantity", "insuranceType", "cargoType", "capacityCbm",
  "cargoDetails", "materialDescription", "packingType", "packageCount", "weightValue", "weightUnit", "materialValue", "hsnCode",
  "clientRate", "freightType", "paymentMode",
  "specialInstructions",
] as const;

type Field = (typeof FIELDS)[number];

export default function RequirementForm({
  clients,
  lockClientName,
  clientMode = false,
  consignorDefaults,
}: {
  clients: { id: string; name: string }[];
  lockClientName?: string;
  clientMode?: boolean;
  consignorDefaults?: Partial<Record<Field, string>>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [form, setForm] = useState<Record<Field, string>>(() => {
    const base = {} as Record<Field, string>;
    for (const f of FIELDS) base[f] = "";
    base.vehicleType = "TRUCK_17FT";
    base.quantity = "1";
    base.serviceType = "GTA";
    base.transactionType = "SPOT";
    base.insuranceType = "NONE";
    base.cargoType = "GENERAL";
    base.weightUnit = "MT";
    base.freightType = "FOR";
    base.paymentMode = "TBB";
    if (consignorDefaults) {
      for (const [k, v] of Object.entries(consignorDefaults)) {
        if (v) base[k as Field] = v;
      }
    }
    return base;
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: Field, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/requirements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, clientId }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save requirement");
      return;
    }
    router.push("/requirements");
    router.refresh();
  }

  const input = (k: Field, label: string, type = "text", required = false) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required ? " *" : ""}
      </label>
      <input
        type={type}
        className="w-full border rounded-md px-3 py-2 text-sm"
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        required={required}
      />
    </div>
  );
  const area = (k: Field, label: string) => (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Route</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client *</label>
            {lockClientName ? (
              <div className="w-full border rounded-md px-3 py-2 text-sm bg-slate-50 text-slate-700">{lockClientName}</div>
            ) : (
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          {input("routeFrom", "From (Origin) *", "text", true)}
          {input("routeTo", "To (Destination) *", "text", true)}
          {input("expectedDate", "Expected Date", "date")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pickup (Consignor)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("consignorName", "Consignor Name")}
          {input("consignorContact", "Contact Person")}
          {input("consignorPhone", "Phone")}
          {area("consignorAddress", "Address")}
          {input("consignorCity", "City")}
          {input("consignorState", "State")}
          {input("consignorPincode", "Pincode")}
          {input("pickupDate", "Pickup Date", "date")}
          {input("pickupTime", "Pickup Time", "time")}
        </CardContent>
      </Card>

      {!clientMode && (
        <Card>
          <CardHeader><CardTitle>Delivery (Consignee)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {input("consigneeName", "Consignee Name")}
            {input("consigneeContact", "Contact Person")}
            {input("consigneePhone", "Phone")}
            {area("consigneeAddress", "Address")}
            {input("consigneeCity", "City")}
            {input("consigneeState", "State")}
            {input("consigneePincode", "Pincode")}
            {input("deliveryDate", "Expected Delivery Date", "date")}
            {input("deliveryTime", "Delivery Time", "time")}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Vehicle Requirement</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Service Type</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.serviceType} onChange={(e) => set("serviceType", e.target.value)}>
              <option value="GTA">GTA</option>
              <option value="COURIER">Courier</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Type</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.transactionType} onChange={(e) => set("transactionType", e.target.value)}>
              <option value="SPOT">Spot</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type *</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)}>
              {vehicleTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Body Type</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.bodyType} onChange={(e) => set("bodyType", e.target.value)}>
              <option value="">—</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Container">Container</option>
              <option value="Flatbed">Flatbed</option>
              <option value="Tanker">Tanker</option>
            </select>
          </div>
          {input("quantity", "No. of Vehicles *", "number", true)}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Type</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.insuranceType} onChange={(e) => set("insuranceType", e.target.value)}>
              <option value="NONE">None</option>
              <option value="OWNER">Owner Risk</option>
              <option value="CARRIER">Carrier Risk</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cargo Type</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.cargoType} onChange={(e) => set("cargoType", e.target.value)}>
              <option value="GENERAL">General</option>
              <option value="FRAGILE">Fragile</option>
              <option value="HAZARDOUS">Hazardous</option>
              <option value="PERISHABLE">Perishable</option>
            </select>
          </div>
          {input("capacityCbm", "Capacity (CBM)", "number")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cargo & Material</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {area("cargoDetails", "Cargo Summary")}
          {area("materialDescription", "Material Description")}
          {input("packingType", "Packing Type")}
          {input("packageCount", "No. of Packages", "number")}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Weight</label>
            <div className="flex gap-2">
              <input type="number" className="w-full border rounded-md px-3 py-2 text-sm" value={form.weightValue} onChange={(e) => set("weightValue", e.target.value)} />
              <select className="border rounded-md px-2 py-2 text-sm bg-white" value={form.weightUnit} onChange={(e) => set("weightUnit", e.target.value)}>
                <option value="MT">MT</option>
                <option value="KG">KG</option>
              </select>
            </div>
          </div>
          {input("materialValue", "Material Value (₹)", "number")}
          {input("hsnCode", "HSN Code")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Freight & Billing</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {input("clientRate", "Client Rate (₹ per vehicle)", "number", clientMode)}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Freight Type</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.freightType} onChange={(e) => set("freightType", e.target.value)}>
              <option value="FOR">FOR (Paid)</option>
              <option value="TO_PAY">To Pay</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>
              <option value="TBB">To Be Billed</option>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
        <CardContent>
          {area("specialInstructions", "Special Instructions")}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Requirement"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
