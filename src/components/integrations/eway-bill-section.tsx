"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import { dateInputMinForField } from "@/lib/date-input";
export type EwayBillFormState = {
  mode: "EXISTING" | "NONE" | "MANUAL";
  ewayBillNumber: string;
  status: string;
  supplierGstin: string;
  recipientGstin: string;
  documentType: string;
  documentNumber: string;
  documentDate: string;
  goodsDescription: string;
  hsnCode: string;
  quantity: string;
  value: string;
  origin: string;
  destination: string;
  transporterName: string;
  transporterGstin: string;
  vehicleNumber: string;
  validUntil: string;
  provider: string;
  fetchedAt: string;
  source: "CLIENT_PROVIDED" | "SHUNLINK_GENERATED" | "MANUAL";
};

export const EMPTY_EWAY_BILL: EwayBillFormState = {
  mode: "NONE",
  ewayBillNumber: "",
  status: "Not Provided",
  supplierGstin: "",
  recipientGstin: "",
  documentType: "",
  documentNumber: "",
  documentDate: "",
  goodsDescription: "",
  hsnCode: "",
  quantity: "",
  value: "",
  origin: "",
  destination: "",
  transporterName: "",
  transporterGstin: "",
  vehicleNumber: "",
  validUntil: "",
  provider: "",
  fetchedAt: "",
  source: "MANUAL",
};

type FieldKey = keyof EwayBillFormState;

export default function EwayBillSection({
  value,
  onChange,
  indentId,
  blockPastDates = false,
}: {
  value: EwayBillFormState;
  onChange: (v: EwayBillFormState) => void;
  indentId?: string;
  /** When true, “Valid until” cannot be before today (indent create). */
  blockPastDates?: boolean;
}) {
  const toast = useToast();
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  const set = (k: FieldKey, v: string) => onChange({ ...value, [k]: v });

  async function fetchEwb() {
    setError("");
    if (!value.ewayBillNumber.trim()) {
      setError("Enter an E-Way Bill number");
      return;
    }
    setFetching(true);
    try {
      const res = await fetch("/api/integrations/ewaybill/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ewayBillNumber: value.ewayBillNumber.trim(),
          indentId,
          persist: false,
        }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Failed to fetch E-Way Bill" });
        return;
      }
      const d = (data as { data: Record<string, string | number | null> }).data;
      onChange({
        ...value,
        mode: "EXISTING",
        ewayBillNumber: String(d.ewayBillNumber ?? value.ewayBillNumber),
        status: String(d.status ?? "Fetched"),
        supplierGstin: String(d.supplierGstin ?? ""),
        recipientGstin: String(d.recipientGstin ?? ""),
        documentType: String(d.documentType ?? ""),
        documentNumber: String(d.documentNumber ?? ""),
        documentDate: String(d.documentDate ?? "").slice(0, 10),
        goodsDescription: String(d.goodsDescription ?? ""),
        hsnCode: String(d.hsnCode ?? ""),
        quantity: String(d.quantity ?? ""),
        value: d.value != null ? String(d.value) : "",
        origin: String(d.origin ?? ""),
        destination: String(d.destination ?? ""),
        transporterName: String(d.transporterName ?? ""),
        transporterGstin: String(d.transporterGstin ?? ""),
        vehicleNumber: String(d.vehicleNumber ?? ""),
        validUntil: String(d.validUntil ?? "").slice(0, 10),
        provider: String(d.provider ?? ""),
        fetchedAt: String(d.fetchedAt ?? new Date().toISOString()),
        source: "CLIENT_PROVIDED",
      });
    } finally {
      setFetching(false);
    }
  }

  const input = (k: FieldKey, label: string, type = "text") => {
    const minDate =
      type === "date" && blockPastDates && k === "validUntil"
        ? dateInputMinForField(value.validUntil, "create")
        : undefined;
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <input
          type={type}
          className="w-full border rounded-md px-3 py-2 text-sm"
          value={value[k] as string}
          onChange={(e) => set(k, e.target.value)}
          min={minDate}
        />
      </div>
    );
  };

  const showFields = value.mode !== "NONE";

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-Way Bill</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={value.mode === "EXISTING"}
              onChange={() =>
                onChange({
                  ...value,
                  mode: "EXISTING",
                  status: value.status === "Not Provided" ? "" : value.status,
                })
              }
            />
            Existing E-Way Bill
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={value.mode === "NONE"}
              onChange={() =>
                onChange({
                  ...EMPTY_EWAY_BILL,
                  mode: "NONE",
                  status: "Not Provided",
                })
              }
            />
            No E-Way Bill provided
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={value.mode === "MANUAL"}
              onChange={() =>
                onChange({
                  ...value,
                  mode: "MANUAL",
                  status: "Not Generated",
                  source: "MANUAL",
                })
              }
            />
            Enter manually (no EWB yet)
          </label>
        </div>

        {value.mode === "EXISTING" && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                E-Way Bill Number
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={value.ewayBillNumber}
                onChange={(e) => set("ewayBillNumber", e.target.value)}
                placeholder="12-digit EBN"
              />
            </div>
            <Button type="button" variant="outline" disabled={fetching} onClick={fetchEwb}>
              {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch E-Way Bill"}
            </Button>
          </div>
        )}

        {value.mode === "NONE" && (
          <p className="text-sm text-slate-500">
            Status: <span className="font-medium text-slate-700">Not Provided</span>
          </p>
        )}

        {value.mode === "MANUAL" && (
          <p className="text-sm text-slate-500">
            Status: <span className="font-medium text-slate-700">Not Generated</span> — enter
            operational E-Way Bill details below.
          </p>
        )}

        {showFields && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            {value.mode === "EXISTING" && input("ewayBillNumber", "E-Way Bill Number")}
            {input("status", "Status")}
            {input("supplierGstin", "Supplier GSTIN")}
            {input("recipientGstin", "Recipient GSTIN")}
            {input("documentNumber", "Document Number")}
            {input("documentDate", "Document Date", "date")}
            {input("goodsDescription", "Goods")}
            {input("hsnCode", "HSN")}
            {input("quantity", "Quantity")}
            {input("value", "Value (₹)", "number")}
            {input("origin", "From")}
            {input("destination", "To")}
            {input("vehicleNumber", "Vehicle Number")}
            {input("validUntil", "Valid Until", "date")}
            {value.provider && (
              <div className="md:col-span-2 text-xs text-slate-500">
                Provider: {value.provider}
                {value.fetchedAt && ` · Fetched ${new Date(value.fetchedAt).toLocaleString()}`}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
