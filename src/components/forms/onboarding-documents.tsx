"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, AlertCircle, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type Doc = { id: string; type: string; url: string; name: string | null };

const ALL_TYPES: [string, string][] = [
  ["GST", "GST Certificate"],
  ["PAN", "PAN Card"],
  ["AADHAAR", "Aadhaar"],
  ["MSME", "MSME / Udyam"],
  ["BANK_PROOF", "Bank Proof (cancelled cheque)"],
  ["CIN", "CIN Certificate"],
  ["AGREEMENT", "Agreement / Contract"],
  ["LICENSE", "Driving License"],
  ["RC", "RC (Registration Certificate)"],
  ["INSURANCE", "Insurance"],
  ["FITNESS", "Fitness Certificate"],
  ["PUC", "PUC Certificate"],
  ["PERMIT", "Permit"],
  ["CLIENT_INVOICE", "Client Invoice"],
  ["VEHICLE_DOC", "Vehicle Document"],
  ["LR", "LR (Lorry Receipt)"],
  ["EWAY_BILL", "E-way Bill"],
  ["POD", "POD (Proof of Delivery)"],
  ["APPROVAL", "Approval / Note"],
  ["OTHER", "Other"],
];

const DOC_LABEL: Record<string, string> = Object.fromEntries(ALL_TYPES);

export type DocTypeConfig = {
  type: string;
  label?: string;
  required?: boolean;
  hint?: string;
};

export default function OnboardingDocuments({
  ownerType,
  ownerId,
  endpoint,
  documents,
  allowedTypes,
  docTypes,
  allowDelete = true,
}: {
  ownerType?: "client" | "vendor" | "vehicle" | "indent" | "driver";
  ownerId?: string;
  endpoint?: string;
  documents: Doc[];
  allowedTypes?: string[];
  /** Structured doc list with required flags — preferred over allowedTypes */
  docTypes?: DocTypeConfig[];
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState("");

  const configs: DocTypeConfig[] = docTypes?.length
    ? docTypes
    : (allowedTypes ?? ALL_TYPES.map(([t]) => t)).map((t) => ({
        type: t,
        label: DOC_LABEL[t] ?? t,
        required: false,
      }));

  const docsByType = new Map<string, Doc[]>();
  for (const d of documents) {
    const list = docsByType.get(d.type) ?? [];
    list.push(d);
    docsByType.set(d.type, list);
  }

  const requiredTypes = configs.filter((c) => c.required).map((c) => c.type);
  const uploadedRequired = requiredTypes.filter((t) => (docsByType.get(t)?.length ?? 0) > 0);
  const progress =
    requiredTypes.length > 0
      ? Math.round((uploadedRequired.length / requiredTypes.length) * 100)
      : 100;

  async function upload(type: string, file: File) {
    setError("");
    setBusyType(type);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    if (!endpoint) {
      if (ownerType) fd.append("ownerType", ownerType);
      if (ownerId) fd.append("ownerId", ownerId);
    }
    const res = await fetch(endpoint ?? "/api/documents", { method: "POST", body: fd });
    setBusyType(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Upload failed");
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    setBusyType("delete");
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setBusyType(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {requiredTypes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Required documents</p>
            <span className="text-sm font-semibold text-slate-900">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {uploadedRequired.length} of {requiredTypes.length} mandatory documents uploaded
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configs.map((cfg) => {
          const uploaded = docsByType.get(cfg.type) ?? [];
          const hasFile = uploaded.length > 0;
          const label = cfg.label ?? DOC_LABEL[cfg.type] ?? cfg.type;
          const isBusy = busyType === cfg.type;

          return (
            <div
              key={cfg.type}
              className={`rounded-xl border-2 p-4 transition-colors ${
                hasFile
                  ? "border-emerald-200 bg-emerald-50/30"
                  : cfg.required
                    ? "border-amber-200 bg-amber-50/20"
                    : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      hasFile ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {hasFile ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-900 leading-tight">{label}</p>
                    {cfg.required && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Required
                      </span>
                    )}
                    {cfg.hint && <p className="text-xs text-slate-500 mt-0.5">{cfg.hint}</p>}
                  </div>
                </div>
              </div>

              {uploaded.length > 0 && (
                <div className="space-y-2 mb-3">
                  {uploaded.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {d.name ?? "View file"}
                      </a>
                      {allowDelete && (
                        <button
                          type="button"
                          onClick={() => remove(d.id)}
                          disabled={busyType === "delete"}
                          className="text-slate-400 hover:text-red-600 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={(el) => {
                  fileRefs.current[cfg.type] = el;
                }}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(cfg.type, file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant={hasFile ? "outline" : "default"}
                size="sm"
                className="w-full rounded-lg"
                disabled={isBusy}
                onClick={() => fileRefs.current[cfg.type]?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-2" />
                {isBusy ? "Uploading..." : hasFile ? "Replace file" : "Upload file"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function hasRequiredDocuments(
  documents: Doc[],
  requiredTypes: string[]
): { ok: boolean; missing: string[] } {
  const uploaded = new Set(documents.map((d) => d.type));
  const missing = requiredTypes.filter((t) => !uploaded.has(t));
  return { ok: missing.length === 0, missing };
}
