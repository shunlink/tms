"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import type { EwayBillIndentDraft } from "@/lib/integrations/ewaybill/map-to-indent";
import {
  type PerionePortalSummary,
  isPerioneEwayValidToday,
  portalSummaryDisplayRows,
} from "@/lib/integrations/ewaybill/portal-summary";

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
  clientId,
  requestGstin,
  onIndentDraft,
  fieldErrors = {},
}: {
  value: EwayBillFormState;
  onChange: (v: EwayBillFormState) => void;
  indentId?: string;
  clientId?: string;
  requestGstin?: string;
  onIndentDraft?: (draft: EwayBillIndentDraft) => void;
  fieldErrors?: Partial<Record<FieldKey, string>>;
  /** @deprecated No longer shown in UI */
  blockPastDates?: boolean;
}) {
  const toast = useToast();
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [portalSummary, setPortalSummary] = useState<PerionePortalSummary | null>(null);

  const numberError = fieldErrors.ewayBillNumber;
  const summaryRows = portalSummary ? portalSummaryDisplayRows(portalSummary) : [];
  const validToday = portalSummary ? isPerioneEwayValidToday(portalSummary) : false;

  async function fetchEwb() {
    setError("");
    setPortalSummary(null);
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
          clientId: clientId || undefined,
          requestGstin: requestGstin?.trim() || undefined,
          persist: false,
        }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Failed to fetch E-Way Bill" });
        return;
      }
      const payload = data as {
        data: Record<string, string | number | null>;
        indentDraft?: EwayBillIndentDraft;
        enrichmentHints?: string[];
        portalSummary?: PerionePortalSummary | null;
      };
      const summary = payload.portalSummary ?? null;
      setPortalSummary(summary);
      const validNow = summary ? isPerioneEwayValidToday(summary) : false;

      const d = payload.data;
      onChange({
        ...value,
        mode: "EXISTING",
        ewayBillNumber: String(summary?.ewbNo ?? d.ewayBillNumber ?? value.ewayBillNumber),
        status: String(summary?.status ?? d.status ?? "Fetched"),
        hsnCode: String(summary?.hsnCode ?? ""),
        vehicleNumber: String(summary?.vehicleNo ?? ""),
        validUntil: String(summary?.validUpto ?? ""),
        provider: String(d.provider ?? ""),
        fetchedAt: String(d.fetchedAt ?? new Date().toISOString()),
        source: "CLIENT_PROVIDED",
        supplierGstin: "",
        recipientGstin: "",
        documentType: "",
        documentNumber: "",
        documentDate: "",
        goodsDescription: "",
        quantity: "",
        value: "",
        origin: "",
        destination: "",
        transporterName: "",
        transporterGstin: "",
      });
      if (payload.indentDraft && onIndentDraft) {
        onIndentDraft(payload.indentDraft);
      }
      const hintLines = payload.enrichmentHints ?? [];
      toast.push({
        variant: "success",
        title: "E-Way Bill loaded",
        description:
          hintLines.length > 0
            ? hintLines.join(" ")
            : validNow
              ? "E-Way Bill is active and valid today. Consignor and consignee pincodes were filled."
              : "Review the E-Way Bill details and complete the indent below.",
      });
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">E-Way Bill Number</label>
          <input
            className={`w-full border rounded-md px-3 py-2 text-sm ${
              numberError ? "border-red-500 focus:ring-red-500" : ""
            }`}
            value={value.ewayBillNumber}
            onChange={(e) => {
              setPortalSummary(null);
              onChange({
                ...value,
                mode: "EXISTING",
                ewayBillNumber: e.target.value,
              });
            }}
            placeholder="12-digit E-Way Bill number"
            inputMode="numeric"
            aria-invalid={numberError ? true : undefined}
            aria-describedby={numberError ? "eway-ewayBillNumber-error" : undefined}
          />
          {numberError && (
            <p id="eway-ewayBillNumber-error" className="text-xs text-red-600 mt-1" role="alert">
              {numberError}
            </p>
          )}
        </div>
        <Button type="button" variant="outline" disabled={fetching} onClick={fetchEwb}>
          {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch E-Way Bill"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {summaryRows.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2 mb-2">
            {validToday && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium" title="Active and valid today">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">Valid today</span>
                <span aria-hidden>Valid today</span>
              </span>
            )}
            <span className="text-slate-600 font-medium">From portal</span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex flex-wrap gap-x-2 min-w-0">
                <dt className="text-slate-500 shrink-0">{row.label}</dt>
                <dd className="text-slate-900 font-medium break-all">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
