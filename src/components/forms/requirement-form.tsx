"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import {
  Route,
  MapPin,
  Truck,
  Building2,
  Package,
  Receipt,
  FileText,
  ChevronDown,
  ArrowRight,
  AlertCircle,
  Clock,
  IndianRupee,
  ShieldCheck,
  Send,
  Boxes,
} from "lucide-react";

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
  const toast = useToast();
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
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to save requirement" });
      return;
    }
    router.push(clientMode ? "/portal/client/requirements" : "/requirements");
    router.refresh();
  }

  const input = (
    k: Field,
    label: string,
    type = "text",
    required = false,
    placeholder?: string
  ) => (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
        {required ? <span className="text-rose-500 ml-0.5">*</span> : null}
      </label>
      <input
        type={type}
        className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs"
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );

  const area = (k: Field, label: string, placeholder?: string) => (
    <div className="md:col-span-2">
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      <textarea
        className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs resize-y"
        rows={2}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* =========================================================================
          SECTION 1: ROUTE & LANE INFORMATION
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Route className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-gray-950">
              Lane & Route Schedule
            </h3>
            <p className="text-xs text-gray-500">
              Specify origin, destination hub, and required dispatch dates
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Client select or locked display */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Client Account <span className="text-rose-500">*</span>
            </label>
            {lockClientName ? (
              <div className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl text-gray-800 font-semibold shadow-2xs truncate">
                {lockClientName}
              </div>
            ) : (
              <div className="relative">
                <select
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-8"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {input("routeFrom", "Origin (City / Hub)", "text", true, "e.g. Pune / Chakan")}
          {input("routeTo", "Destination (City / Hub)", "text", true, "e.g. Bhiwandi / Mumbai")}
          {input("expectedDate", "Expected Loading Date", "date")}
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: VEHICLE & EQUIPMENT SPECIFICATIONS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-gray-950">
              Vehicle & Fleet Requirements
            </h3>
            <p className="text-xs text-gray-500">
              Select truck capacity, vehicle types, and fleet quantity
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vehicle Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Vehicle Type <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-8 cursor-pointer"
                value={form.vehicleType}
                onChange={(e) => set("vehicleType", e.target.value)}
              >
                {vehicleTypes.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Quantity */}
          {input("quantity", "No. of Vehicles", "number", true, "1")}

          {/* Body Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Body Type</label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-8 cursor-pointer"
                value={form.bodyType}
                onChange={(e) => set("bodyType", e.target.value)}
              >
                <option value="">Standard / Flexible</option>
                <option value="Open">Open Body</option>
                <option value="Closed">Closed Container</option>
                <option value="Container">High-Cube Container</option>
                <option value="Flatbed">Flatbed Trailer</option>
                <option value="Tanker">Tanker</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Capacity CBM */}
          {input("capacityCbm", "Capacity (CBM)", "number", false, "e.g. 32")}

          {/* Cargo Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cargo Type</label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-8 cursor-pointer"
                value={form.cargoType}
                onChange={(e) => set("cargoType", e.target.value)}
              >
                <option value="GENERAL">General Goods</option>
                <option value="FRAGILE">Fragile / High-Value</option>
                <option value="HAZARDOUS">Hazardous / Chemical</option>
                <option value="PERISHABLE">Perishable / Cold</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Insurance Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Insurance Coverage</label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-8 cursor-pointer"
                value={form.insuranceType}
                onChange={(e) => set("insuranceType", e.target.value)}
              >
                <option value="NONE">None / Self-Insured</option>
                <option value="OWNER">Owner Risk</option>
                <option value="CARRIER">Carrier Risk</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Service Type</label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-8 cursor-pointer"
                value={form.serviceType}
                onChange={(e) => set("serviceType", e.target.value)}
              >
                <option value="GTA">GTA (Goods Transport Agency)</option>
                <option value="COURIER">Express Courier</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Transaction Type</label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-8 cursor-pointer"
                value={form.transactionType}
                onChange={(e) => set("transactionType", e.target.value)}
              >
                <option value="SPOT">Spot Indent</option>
                <option value="CONTRACT">Contracted Lane</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: PICKUP LOCATION (CONSIGNOR)
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-gray-950">
              Pickup Point (Consignor)
            </h3>
            <p className="text-xs text-gray-500">
              Loading address, site coordinator contacts, and preferred reporting window
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("consignorName", "Consignor Entity Name", "text", false, "e.g. Tata Motors Plant 1")}
          {input("consignorContact", "Site Coordinator Name", "text", false, "e.g. Ramesh Kumar")}
          {input("consignorPhone", "Coordinator Contact Phone", "tel", false, "e.g. 9876543210")}
          {input("consignorPincode", "Pickup Pincode", "text", false, "e.g. 411018")}
          {area("consignorAddress", "Loading Facility Address", "Full street / plot / industrial area")}
          {input("consignorCity", "City", "text", false, "e.g. Pune")}
          {input("consignorState", "State", "text", false, "e.g. Maharashtra")}
          {input("pickupDate", "Scheduled Loading Date", "date")}
          {input("pickupTime", "Preferred Reporting Time", "time")}
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: DELIVERY LOCATION (CONSIGNEE) - When applicable
          ========================================================================= */}
      {!clientMode && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-gray-950">
                Delivery Point (Consignee)
              </h3>
              <p className="text-xs text-gray-500">
                Unloading warehouse address, receiver contact, and expected delivery
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {input("consigneeName", "Consignee Entity Name")}
            {input("consigneeContact", "Receiver Contact Person")}
            {input("consigneePhone", "Receiver Phone")}
            {input("consigneePincode", "Delivery Pincode")}
            {area("consigneeAddress", "Delivery Facility Address")}
            {input("consigneeCity", "City")}
            {input("consigneeState", "State")}
            {input("deliveryDate", "Target Delivery Date", "date")}
            {input("deliveryTime", "Target Delivery Time", "time")}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 5: CARGO & MATERIAL DETAILS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-gray-950">
              Cargo & Material Details
            </h3>
            <p className="text-xs text-gray-500">
              Goods classification, weight values, packaging, and commercial value
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {area("cargoDetails", "Cargo Summary", "e.g. Automotive components, palletized cartons")}
          {area("materialDescription", "Detailed Material Description", "Technical specifications or safety notes")}
          {input("packingType", "Packing Type", "text", false, "e.g. Wooden Pallets, Corrugated Boxes")}
          {input("packageCount", "Total No. of Packages", "number", false, "e.g. 120")}

          {/* Weight Value + Unit */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Weight & Unit
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs"
                placeholder="e.g. 15.5"
                value={form.weightValue}
                onChange={(e) => set("weightValue", e.target.value)}
              />
              <div className="relative shrink-0 w-24">
                <select
                  className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-7 cursor-pointer"
                  value={form.weightUnit}
                  onChange={(e) => set("weightUnit", e.target.value)}
                >
                  <option value="MT">MT</option>
                  <option value="KG">KG</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {input("materialValue", "Declared Material Value (₹)", "number", false, "e.g. 1500000")}
          {input("hsnCode", "HSN Code", "text", false, "e.g. 8708")}
        </div>
      </div>

      {/* =========================================================================
          SECTION 6: FREIGHT PRICING & BILLING TERMS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-gray-950">
              Freight Pricing & Billing Terms
            </h3>
            <p className="text-xs text-gray-500">
              Agreed client budget rate and payment settlement mechanism
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target Rate */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Client Target Rate (₹ per vehicle)
              {clientMode ? <span className="text-rose-500 ml-0.5">*</span> : null}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                required={clientMode}
                className="w-full pl-8 pr-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs"
                placeholder="e.g. 45000"
                value={form.clientRate}
                onChange={(e) => set("clientRate", e.target.value)}
              />
            </div>
          </div>

          {/* Freight Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Freight Type</label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-8 cursor-pointer"
                value={form.freightType}
                onChange={(e) => set("freightType", e.target.value)}
              >
                <option value="FOR">FOR (Freight on Road / Pre-paid)</option>
                <option value="TO_PAY">To Pay (Payable at Destination)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Payment Mode</label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs appearance-none pr-8 cursor-pointer"
                value={form.paymentMode}
                onChange={(e) => set("paymentMode", e.target.value)}
              >
                <option value="TBB">TBB (To Be Billed / Periodic Invoice)</option>
                <option value="CASH">Cash / Advance</option>
                <option value="CREDIT">Credit Terms</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 7: SPECIAL INSTRUCTIONS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
          <div className="h-10 w-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-gray-950">
              Special Handling & Dispatch Instructions
            </h3>
            <p className="text-xs text-gray-500">
              Vehicle entry timings, PPE protocols, tarpaulin, or stacking constraints
            </p>
          </div>
        </div>

        <div>
          <textarea
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/40 focus:border-[#F5D33C] transition-all hover:border-gray-300 shadow-2xs resize-y"
            rows={3}
            value={form.specialInstructions}
            onChange={(e) => set("specialInstructions", e.target.value)}
            placeholder="Add any specific instructions for drivers, loading docks, or transit constraints..."
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs sm:text-sm text-rose-700 font-medium">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Submit / Cancel Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs sm:text-sm transition-colors shadow-2xs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          <span>{saving ? "Submitting Requirement..." : "Submit Requirement"}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
