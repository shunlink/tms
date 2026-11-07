"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EwayBillSection, {
  EMPTY_EWAY_BILL,
  type EwayBillFormState,
} from "@/components/integrations/eway-bill-section";
import IndentVehicleSlots, { type VehicleSlotView } from "@/components/forms/indent-vehicle-slots";
import { IndentFileUploadsTrigger, type IndentDoc } from "@/components/forms/indent-documents-modal";
import AddressSuggestField from "@/components/forms/address-suggest-field";
import PrefixSuggestField from "@/components/forms/prefix-suggest-field";
import { indentSaveSchema, splitIndentSaveFieldErrors, summarizeIndentSaveIssues } from "@/lib/validation";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import type { EwayBillIndentDraft } from "@/lib/integrations/ewaybill/map-to-indent";
import type { AddressSuggestion } from "@/lib/address-suggestion";
import { useToast } from "@/components/toast";
import {
  mergeConsignorPrefillIntoForm,
  type ConsignorPrefillFromClient,
} from "@/lib/client-indent-consignor-prefill";

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
  "indentDate",
  "consignorName", "consignorAddress", "consignorCity", "consignorState", "consignorPincode", "consignorGstin", "consignorContact", "consignorPhone", "pickupDate", "pickupTime",
  "consigneeName", "consigneeAddress", "consigneeCity", "consigneeState", "consigneePincode", "consigneeGstin", "consigneeContact", "consigneePhone", "deliveryDate", "deliveryTime",
  "serviceType", "transactionType", "vehicleType", "bodyType", "quantity", "insuranceType", "cargoType", "capacityCbm", "podDueAt",
  "materialDescription", "packingType", "packageCount", "weightValue", "weightUnit", "weightKg", "materialValue", "hsnCode", "invoiceNumber", "invoiceValue",
  "clientRate", "freightType", "paymentMode",
  "specialInstructions", "remarks",
] as const;

type Field = (typeof FIELDS)[number];

export type IndentFormValues = Record<Field, string>;

const DEFAULTS: IndentFormValues = {
  indentDate: "",
  consignorName: "", consignorAddress: "", consignorCity: "", consignorState: "", consignorPincode: "",
  consignorGstin: "", consignorContact: "", consignorPhone: "", pickupDate: "", pickupTime: "",
  consigneeName: "", consigneeAddress: "", consigneeCity: "", consigneeState: "", consigneePincode: "",
  consigneeGstin: "", consigneeContact: "", consigneePhone: "", deliveryDate: "", deliveryTime: "",
  serviceType: "GTA", transactionType: "SPOT", vehicleType: "TRUCK_17FT", bodyType: "", quantity: "1",
  insuranceType: "NONE", cargoType: "GENERAL", capacityCbm: "", podDueAt: "",
  materialDescription: "", packingType: "", packageCount: "", weightValue: "", weightUnit: "MT", weightKg: "",
  materialValue: "", hsnCode: "", invoiceNumber: "", invoiceValue: "",
  clientRate: "", freightType: "FOR", paymentMode: "TBB",
  specialInstructions: "", remarks: "",
};

export function buildIndentFormDefaults(overrides?: Partial<IndentFormValues>): IndentFormValues {
  return { ...DEFAULTS, ...overrides };
}

type DriverFields = {
  name: string;
  dlNumber: string;
  phone: string;
  deviceType: string;
};

export default function IndentForm({
  clients,
  mode = "create",
  indentId,
  requirementId,
  initialValues,
  lockClientName,
  lockedClientId,
  vendorAllocated = false,
  vendorName,
  placementStatus,
  vehicleReached = false,
  initialVehicleReg = "",
  initialDriver,
  initialEwayBillRequired = false,
  initialEwayBill,
  driverAssigned = false,
  vehicleSlots,
  canMarkPlacement = false,
  documents = [],
}: {
  clients: { id: string; name: string }[];
  mode?: "create" | "edit";
  indentId?: string;
  requirementId?: string;
  initialValues?: Partial<IndentFormValues>;
  lockClientName?: string;
  lockedClientId?: string;
  vendorAllocated?: boolean;
  vendorName?: string | null;
  placementStatus?: string | null;
  vehicleReached?: boolean;
  initialVehicleReg?: string;
  initialDriver?: Partial<DriverFields & { id?: string }>;
  initialEwayBillRequired?: boolean;
  initialEwayBill?: Partial<EwayBillFormState> | null;
  driverAssigned?: boolean;
  vehicleSlots?: VehicleSlotView[];
  canMarkPlacement?: boolean;
  documents?: IndentDoc[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [clientId, setClientId] = useState(lockedClientId ?? clients[0]?.id ?? "");
  const [form, setForm] = useState<IndentFormValues>(() => buildIndentFormDefaults(initialValues));
  const [vehicleReg, setVehicleReg] = useState(initialVehicleReg);
  const [existingVehicleFound, setExistingVehicleFound] = useState(false);
  const [vehicleNotFound, setVehicleNotFound] = useState(false);
  const [vehicleLookup, setVehicleLookup] = useState<{
    id: string;
    registrationNumber: string;
    vehicleTypeCode: string;
    make: string | null;
    model: string | null;
    ownership: string | null;
    compliance: {
      ownerName: string | null;
      rcNumber: string | null;
      rcExpiry: string | null;
      insuranceExpiry: string | null;
      fitnessExpiry: string | null;
      pucExpiry: string | null;
      rcVerified: boolean;
      rcVerificationStatus: string | null;
      complianceState: string | null;
      fuelType: string | null;
      vehicleClass: string | null;
    } | null;
  } | null>(null);
  const [driver, setDriver] = useState<DriverFields>({
    name: initialDriver?.name ?? "",
    dlNumber: initialDriver?.dlNumber ?? "",
    phone: initialDriver?.phone ?? "",
    deviceType: initialDriver?.deviceType ?? "SMARTPHONE",
  });
  const [existingDriverFound, setExistingDriverFound] = useState(false);
  const [driverErrors, setDriverErrors] = useState<Record<string, string>>({});
  const [ewayBillRequired, setEwayBillRequired] = useState(initialEwayBillRequired);
  const [ewayBill, setEwayBill] = useState<EwayBillFormState>(() => ({
    ...EMPTY_EWAY_BILL,
    ...initialEwayBill,
    mode: initialEwayBill?.mode ?? "NONE",
  }));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ewayFieldErrors, setEwayFieldErrors] = useState<Record<string, string>>({});
  const [vehicleDriverError, setVehicleDriverError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingVehicleDriver, setSavingVehicleDriver] = useState(false);

  function scrollToFirstValidationIssue(
    formErrs: Record<string, string>,
    ewayErrs: Record<string, string>
  ) {
    requestAnimationFrame(() => {
      const ewayKey = Object.keys(ewayErrs)[0];
      if (ewayKey) {
        document.getElementById(`eway-${ewayKey}-error`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const formKey = Object.keys(formErrs)[0];
      if (formKey) {
        document.getElementById(`${formKey}-error`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  function applySaveValidationErrors(
    formErrs: Record<string, string>,
    ewayErrs: Record<string, string>,
    summary: string
  ) {
    setFieldErrors(formErrs);
    setEwayFieldErrors(ewayErrs);
    setError(summary);
    toast.push({ variant: "error", title: "Could not save indent", description: summary });
    scrollToFirstValidationIssue(formErrs, ewayErrs);
  }

  const set = (k: Field, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (fieldErrors[k]) {
      setFieldErrors((fe) => {
        const next = { ...fe };
        delete next[k];
        return next;
      });
    }
  };

  function applyAddressSuggestion(side: "consignor" | "consignee", s: AddressSuggestion) {
    const prefix = side === "consignor" ? "consignor" : "consignee";
    setForm((f) => ({
      ...f,
      [`${prefix}Address`]: s.addressLine1,
      [`${prefix}City`]: s.city,
      [`${prefix}State`]: s.state,
      [`${prefix}Pincode`]: s.pincode,
    }));
    setFieldErrors((fe) => {
      const next = { ...fe };
      for (const key of [
        `${prefix}Address`,
        `${prefix}City`,
        `${prefix}State`,
        `${prefix}Pincode`,
      ]) {
        delete next[key];
      }
      return next;
    });
  }

  const applyEwayIndentDraft = useCallback((draft: EwayBillIndentDraft) => {
    setForm((prev) => {
      const next = { ...prev };
      for (const [key, val] of Object.entries(draft)) {
        if (key in next && val != null && String(val).trim() !== "") {
          next[key as Field] = String(val);
        }
      }
      return next;
    });
    setEwayBillRequired(true);
  }, []);

  const applyClientConsignorPrefill = useCallback(async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/clients/${encodeURIComponent(id)}/indent-consignor-prefill`);
    const data = await readJsonBody(res);
    if (!res.ok) return;
    const prefill = data as ConsignorPrefillFromClient;
    setForm((prev) =>
      mergeConsignorPrefillIntoForm(prefill, prev as ConsignorPrefillFromClient & IndentFormValues)
    );
  }, []);

  useEffect(() => {
    if (clientId) void applyClientConsignorPrefill(clientId);
  }, [clientId, applyClientConsignorPrefill]);

  function buildIndentSavePayload() {
    return {
      ...form,
      clientId,
      requirementId: requirementId ?? null,
      ewayBillRequired,
      ewayBill: {
        ...ewayBill,
        value: ewayBill.value ? Number(ewayBill.value) : null,
      },
      weightKg: form.weightValue || form.weightKg,
    };
  }

  const inPlacement =
    vendorAllocated && !vehicleReached && placementStatus === "PLACEMENT_PENDING";
  const canAssignVehicleDriver = mode === "edit" && vehicleReached;

  async function lookupVehicleByReg(reg: string) {
    const trimmed = reg.trim();
    if (!trimmed || trimmed.length < 4) {
      setExistingVehicleFound(false);
      setVehicleNotFound(false);
      setVehicleLookup(null);
      return;
    }
    const res = await fetch(
      `/api/vehicles/lookup?registrationNumber=${encodeURIComponent(trimmed)}`
    );
    const data = await readJsonBody(res);
    const body = data as { found?: boolean; vehicle?: { registrationNumber?: string } };
    if (res.status === 404 || body.found === false) {
      setExistingVehicleFound(false);
      setVehicleNotFound(true);
      setVehicleLookup(null);
      return;
    }
    if (!res.ok || !body.found || !body.vehicle) {
      setExistingVehicleFound(false);
      setVehicleNotFound(false);
      setVehicleLookup(null);
      return;
    }
    setExistingVehicleFound(true);
    setVehicleNotFound(false);
    setVehicleLookup(body.vehicle as NonNullable<typeof vehicleLookup>);
    setVehicleReg(String(body.vehicle.registrationNumber ?? trimmed).toUpperCase());
  }

  async function lookupDriverByDl(dl: string) {
    if (!dl.trim() || dl.trim().length < 4) return;
    const res = await fetch(`/api/drivers/lookup?dl=${encodeURIComponent(dl.trim())}`);
    const data = await readJsonBody(res);
    const body = data as { found?: boolean; driver?: { name?: string; phone?: string; deviceType?: string } };
    if (!res.ok || !body.found) {
      setExistingDriverFound(false);
      return;
    }
    setExistingDriverFound(true);
    setDriver((d) => ({
      ...d,
      name: body.driver?.name ?? d.name,
      phone: body.driver?.phone ?? d.phone,
      deviceType: body.driver?.deviceType ?? d.deviceType,
    }));
  }

  function validateDriverFields() {
    const errors: Record<string, string> = {};
    if (!driver.name.trim()) errors.name = "Driver name is required";
    if (!driver.dlNumber.trim() || driver.dlNumber.trim().length < 4) {
      errors.dlNumber = "DL number is required";
    }
    if (!driver.phone.trim()) errors.phone = "Driver mobile is required";
    setDriverErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function saveVehicleDriver() {
    if (!indentId || !canAssignVehicleDriver) return;
    setVehicleDriverError("");
    setDriverErrors({});

    const hasVehicle = vehicleReg.trim().length > 0;
    const hasDriverInput =
      driver.name.trim() && driver.dlNumber.trim() && driver.phone.trim();

    if (!hasVehicle && !hasDriverInput) {
      setVehicleDriverError("Enter vehicle registration and/or driver details to save");
      return;
    }

    if (hasDriverInput && !validateDriverFields()) {
      return;
    }

    setSavingVehicleDriver(true);
    try {
      if (hasVehicle) {
        const vRes = await fetch(`/api/indents/${indentId}/vehicle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationNumber: vehicleReg.trim(),
            vehicleTypeCode: form.vehicleType,
            bodyTypeCode: form.bodyType || null,
          }),
        });
        if (!vRes.ok) {
          const vData = await vRes.json().catch(() => ({}));
          setVehicleDriverError(vData.error || "Vehicle assignment failed");
          return;
        }
      }

      if (hasDriverInput) {
        const dRes = await fetch(`/api/indents/${indentId}/driver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(driver),
        });
        const dData = await dRes.json().catch(() => ({}));
        if (!dRes.ok) {
          setVehicleDriverError(dData.error || "Driver registration failed");
          return;
        }
        toast.push({ variant: "success", title: "Driver assigned" });
      }

      router.refresh();
    } finally {
      setSavingVehicleDriver(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setEwayFieldErrors({});

    const payload = buildIndentSavePayload();
    const parsed = indentSaveSchema.safeParse(payload);
    if (!parsed.success) {
      const { form: formErrs, eway: ewayErrs } = splitIndentSaveFieldErrors(parsed.error.issues);
      applySaveValidationErrors(formErrs, ewayErrs, summarizeIndentSaveIssues(parsed.error.issues));
      return;
    }

    setSaving(true);

    try {
      if (mode === "create") {
        const res = await fetch("/api/indents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await readJsonBody(res);
        if (!res.ok) {
          const err = reportApiFailure(res, data, { toast, setError, fallback: "Failed to save indent" });
          if (err.fieldErrors) setFieldErrors(err.fieldErrors);
          return;
        }
        router.push(`/indents/${(data as { id: string }).id}`);
        router.refresh();
        return;
      }

      if (!indentId) {
        setError("Missing indent id");
        return;
      }

      const res = await fetch(`/api/indents/${indentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        const err = reportApiFailure(res, data, { toast, setError, fallback: "Failed to update indent" });
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
        return;
      }

      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const fieldErr = (key: string) => fieldErrors[key];
  const pincodeInput = (side: "consignor" | "consignee", label: string, required = false) => {
    const k = side === "consignor" ? "consignorPincode" : "consigneePincode";
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
          {required ? " *" : ""}
        </label>
        <input
          type="text"
          inputMode="numeric"
          className={inputCls(k)}
          value={form[k]}
          onChange={(e) => set(k, e.target.value)}
          required={required}
          aria-invalid={fieldErr(k) ? true : undefined}
          aria-describedby={fieldErr(k) ? `${k}-error` : undefined}
        />
        {fieldErr(k) && (
          <p id={`${k}-error`} className="text-xs text-red-600 mt-1" role="alert">
            {fieldErr(k)}
          </p>
        )}
      </div>
    );
  };
  const inputCls = (key: string) =>
    `w-full border rounded-md px-3 py-2 text-sm ${fieldErr(key) ? "border-red-500 focus:ring-red-500" : ""}`;

  const input = (k: Field, label: string, type = "text", required = false) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type={type}
        className={inputCls(k)}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        required={required}
        aria-invalid={fieldErr(k) ? true : undefined}
        aria-describedby={fieldErr(k) ? `${k}-error` : undefined}
      />
      {fieldErr(k) && (
        <p id={`${k}-error`} className="text-xs text-red-600 mt-1" role="alert">
          {fieldErr(k)}
        </p>
      )}
    </div>
  );
  const area = (k: Field, label: string, required = false) => (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required ? " *" : ""}
      </label>
      <textarea
        className={inputCls(k)}
        rows={2}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        required={required}
        aria-invalid={fieldErr(k) ? true : undefined}
        aria-describedby={fieldErr(k) ? `${k}-error` : undefined}
      />
      {fieldErr(k) && (
        <p id={`${k}-error`} className="text-xs text-red-600 mt-1" role="alert">
          {fieldErr(k)}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Indent Header</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client *</label>
            {lockClientName ? (
              <div className="w-full border rounded-md px-3 py-2 text-sm bg-slate-50 text-slate-700">{lockClientName}</div>
            ) : (
              <select
                className={inputCls("clientId")}
                value={clientId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setClientId(nextId);
                  void applyClientConsignorPrefill(nextId);
                  if (fieldErrors.clientId) {
                    setFieldErrors((fe) => {
                      const next = { ...fe };
                      delete next.clientId;
                      return next;
                    });
                  }
                }}
                required
                aria-invalid={fieldErr("clientId") ? true : undefined}
              >
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {fieldErr("clientId") && (
              <p className="text-xs text-red-600 mt-1" role="alert">{fieldErr("clientId")}</p>
            )}
          </div>
          {input("indentDate", "Indent Date", "date", true)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>E-way Bill</CardTitle>
          <p className="text-sm text-slate-500 font-normal">
            Enter the E-Way Bill number and fetch — details fill into the indent sections below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={ewayBillRequired}
              onChange={(e) => {
                const checked = e.target.checked;
                setEwayBillRequired(checked);
                if (checked) {
                  setEwayBill((prev) => ({ ...prev, mode: "EXISTING" }));
                } else {
                  setEwayBill({ ...EMPTY_EWAY_BILL, mode: "NONE", status: "Not Provided" });
                  setEwayFieldErrors({});
                }
              }}
            />
            E-way bill required for this indent
          </label>
          {ewayBillRequired && (
            <EwayBillSection
              value={ewayBill}
              onChange={(next) => {
                setEwayBill(next);
                setEwayFieldErrors({});
              }}
              fieldErrors={ewayFieldErrors}
              indentId={indentId}
              clientId={clientId}
              requestGstin={form.consignorGstin}
              onIndentDraft={applyEwayIndentDraft}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Consignor (Pickup)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("consignorName", "Consignor Name", "text", true)}
          {input("consignorGstin", "Consignor GSTIN", "text", true)}
          <AddressSuggestField
            clientId={clientId}
            side="consignor"
            label="Address"
            value={form.consignorAddress}
            required
            error={fieldErr("consignorAddress")}
            onChange={(v) => set("consignorAddress", v)}
            onSelect={(s) => applyAddressSuggestion("consignor", s)}
          />
          {input("consignorCity", "City", "text", true)}
          {input("consignorState", "State", "text", true)}
          {pincodeInput("consignor", "Pincode", true)}
          {input("consignorContact", "Contact Person")}
          {input("consignorPhone", "Phone")}
          {input("pickupDate", "Pickup Date", "date", true)}
          {input("pickupTime", "Pickup Time", "time")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Consignee (Delivery)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("consigneeName", "Consignee Name", "text", true)}
          {input("consigneeGstin", "Consignee GSTIN", "text", true)}
          <AddressSuggestField
            clientId={clientId}
            side="consignee"
            label="Address"
            value={form.consigneeAddress}
            required
            error={fieldErr("consigneeAddress")}
            onChange={(v) => set("consigneeAddress", v)}
            onSelect={(s) => applyAddressSuggestion("consignee", s)}
          />
          {input("consigneeCity", "City", "text", true)}
          {input("consigneeState", "State", "text", true)}
          {pincodeInput("consignee", "Pincode", true)}
          {input("consigneeContact", "Contact Person")}
          {input("consigneePhone", "Phone")}
          {input("deliveryDate", "Expected Delivery Date", "date")}
          {input("deliveryTime", "Delivery Time", "time")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vehicle Requirement</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Service Type *</label>
            <select className={inputCls("serviceType")} value={form.serviceType} onChange={(e) => set("serviceType", e.target.value)}>
              <option value="GTA">GTA</option>
              <option value="COURIER">Courier</option>
            </select>
            {fieldErr("serviceType") && <p className="text-xs text-red-600 mt-1" role="alert">{fieldErr("serviceType")}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Type *</label>
            <select className={inputCls("transactionType")} value={form.transactionType} onChange={(e) => set("transactionType", e.target.value)}>
              <option value="SPOT">Spot</option>
              <option value="CONTRACT">Contract</option>
            </select>
            {fieldErr("transactionType") && <p className="text-xs text-red-600 mt-1" role="alert">{fieldErr("transactionType")}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type *</label>
            <select className={inputCls("vehicleType")} value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)}>
              {vehicleTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {fieldErr("vehicleType") && <p className="text-xs text-red-600 mt-1" role="alert">{fieldErr("vehicleType")}</p>}
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
          {input("quantity", "No. of Vehicles", "number", true)}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Type *</label>
            <select className={inputCls("insuranceType")} value={form.insuranceType} onChange={(e) => set("insuranceType", e.target.value)}>
              <option value="NONE">None</option>
              <option value="OWNER">Owner Risk</option>
              <option value="CARRIER">Carrier Risk</option>
            </select>
            {fieldErr("insuranceType") && <p className="text-xs text-red-600 mt-1" role="alert">{fieldErr("insuranceType")}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cargo Type *</label>
            <select className={inputCls("cargoType")} value={form.cargoType} onChange={(e) => set("cargoType", e.target.value)}>
              <option value="GENERAL">General</option>
              <option value="FRAGILE">Fragile</option>
              <option value="HAZARDOUS">Hazardous</option>
              <option value="PERISHABLE">Perishable</option>
            </select>
            {fieldErr("cargoType") && <p className="text-xs text-red-600 mt-1" role="alert">{fieldErr("cargoType")}</p>}
          </div>
          {input("capacityCbm", "Capacity (CBM)", "number")}
          {input("podDueAt", "POD Due Date", "date")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Material</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          {input("invoiceNumber", "Invoice Number")}
          {input("invoiceValue", "Invoice Value (₹)", "number")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Freight & Billing</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {input("clientRate", "Client Rate (₹)", "number", true)}
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

      {mode === "edit" && indentId && vehicleSlots && vehicleSlots.length > 0 ? (
        <IndentVehicleSlots
          indentId={indentId}
          vendorAllocated={vendorAllocated}
          vendorName={vendorName}
          vehicleTypeCode={form.vehicleType}
          bodyTypeCode={form.bodyType}
          slots={vehicleSlots}
          canMarkPlacement={canMarkPlacement}
        />
      ) : (
      <Card className={canAssignVehicleDriver ? "border-blue-200" : "border-slate-200"}>
        <CardHeader>
          <CardTitle>Vehicle & Driver Assignment</CardTitle>
          <p className="text-sm text-slate-500 font-normal">
            {!vendorAllocated
              ? "Vehicle and driver details are available after vendor allocation."
              : vendorName
                ? `Vendor allocated: ${vendorName}`
                : "Vendor allocated."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {inPlacement && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Vehicle and driver details can only be filled after the vehicle has reached placement.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <PrefixSuggestField
                label="Vehicle Registration"
                value={vehicleReg}
                suggestUrl="/api/vehicles/suggest"
                disabled={!canAssignVehicleDriver}
                placeholder="e.g. MH12AB1234"
                onChange={(v) => {
                  setVehicleReg(v);
                  setExistingVehicleFound(false);
                  setVehicleNotFound(false);
                  setVehicleLookup(null);
                }}
                onSelect={(s) => {
                  setVehicleReg(s.value);
                  void lookupVehicleByReg(s.value);
                }}
              />
              {existingVehicleFound && vehicleLookup && (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 space-y-1">
                  <p className="font-medium">Existing vehicle found in Vehicle Master</p>
                  <p>
                    {vehicleLookup.vehicleTypeCode.replace(/_/g, " ")}
                    {vehicleLookup.make || vehicleLookup.model
                      ? ` · ${[vehicleLookup.make, vehicleLookup.model].filter(Boolean).join(" ")}`
                      : ""}
                    {vehicleLookup.ownership ? ` · ${vehicleLookup.ownership}` : ""}
                  </p>
                  {vehicleLookup.compliance?.ownerName && (
                    <p>Owner: {vehicleLookup.compliance.ownerName}</p>
                  )}
                  {vehicleLookup.compliance && (
                    <p>
                      RC: {vehicleLookup.compliance.rcVerificationStatus ?? (vehicleLookup.compliance.rcVerified ? "Verified" : "Not verified")}
                      {vehicleLookup.compliance.complianceState
                        ? ` · Compliance: ${vehicleLookup.compliance.complianceState}`
                        : ""}
                      {vehicleLookup.compliance.insuranceExpiry
                        ? ` · Insurance exp: ${vehicleLookup.compliance.insuranceExpiry.slice(0, 10)}`
                        : ""}
                    </p>
                  )}
                </div>
              )}
              {vehicleNotFound && (
                <p className="text-xs text-amber-700 mt-1">
                  Vehicle not found in Vehicle Master — it will be created when you save assignment.
                </p>
              )}
            </div>
            <div />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                value={driver.name}
                onChange={(e) => setDriver((d) => ({ ...d, name: e.target.value }))}
                disabled={!canAssignVehicleDriver}
              />
              {driverErrors.name && <p className="text-xs text-red-600 mt-1">{driverErrors.name}</p>}
            </div>
            <div>
              <PrefixSuggestField
                label="DL Number (primary identity)"
                value={driver.dlNumber}
                suggestUrl="/api/drivers/suggest"
                disabled={!canAssignVehicleDriver}
                placeholder="MH0123456789"
                error={driverErrors.dlNumber}
                onChange={(v) => {
                  setDriver((d) => ({ ...d, dlNumber: v }));
                  setExistingDriverFound(false);
                }}
                onSelect={(s) => {
                  setDriver((d) => ({
                    ...d,
                    dlNumber: s.value,
                    name: typeof s.name === "string" && s.name ? s.name : d.name,
                    phone: typeof s.phone === "string" && s.phone ? s.phone : d.phone,
                    deviceType:
                      typeof s.deviceType === "string" && s.deviceType ? s.deviceType : d.deviceType,
                  }));
                  setExistingDriverFound(true);
                  void lookupDriverByDl(s.value);
                }}
              />
              {existingDriverFound && (
                <p className="text-xs text-blue-600 mt-1">Existing driver found — details loaded</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Driver Mobile</label>
              <input
                type="tel"
                className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                value={driver.phone}
                onChange={(e) => setDriver((d) => ({ ...d, phone: e.target.value }))}
                disabled={!canAssignVehicleDriver}
              />
              {driverErrors.phone && <p className="text-xs text-red-600 mt-1">{driverErrors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Device Type</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
                value={driver.deviceType}
                onChange={(e) => setDriver((d) => ({ ...d, deviceType: e.target.value }))}
                disabled={!canAssignVehicleDriver}
              >
                <option value="SMARTPHONE">Smartphone</option>
                <option value="FEATURE_PHONE">Feature Phone</option>
              </select>
            </div>
          </div>

          {canAssignVehicleDriver && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingVehicleDriver}
                onClick={saveVehicleDriver}
              >
                {savingVehicleDriver ? "Saving..." : "Save Vehicle & Driver"}
              </Button>
            </div>
          )}

          {vehicleDriverError && <p className="text-sm text-red-600">{vehicleDriverError}</p>}
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <p className="text-sm text-slate-500 font-normal">
            Upload Manual LR, e-way bill, invoices, vehicle and driver papers, and other trip docs.
          </p>
        </CardHeader>
        <CardContent>
          <IndentFileUploadsTrigger
            indentId={indentId}
            documents={documents}
            disabled={mode === "create" || !indentId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {area("specialInstructions", "Special Instructions")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>LR print (optional)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {area("remarks", "Comments for LR")}
          <p className="text-xs text-slate-500">
            If filled, this appears in the Comments row on the lorry receipt (E-Way section). Leave blank to print nothing there.
          </p>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Indent"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
