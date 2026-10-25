"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import {
  isMockVerification,
  isSuccessfulVerification,
} from "@/lib/integrations/core/verification-status";

type GstMeta = {
  verificationStatus?: string | null;
  verifiedAt?: string | null;
  provider?: string | null;
};

export default function GstVerificationField({
  gstin,
  onGstinChange,
  onVerified,
  entityType,
  entityId,
  initialMeta,
  required = false,
  disabled = false,
}: {
  gstin: string;
  onGstinChange: (v: string) => void;
  onVerified: (data: Record<string, unknown>) => void;
  entityType?: "CLIENT" | "VENDOR";
  entityId?: string;
  initialMeta?: GstMeta;
  required?: boolean;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<GstMeta | null>(
    initialMeta?.verificationStatus
      ? {
          verificationStatus: initialMeta.verificationStatus,
          verifiedAt: initialMeta.verifiedAt ?? null,
          provider: initialMeta.provider ?? null,
        }
      : null
  );

  async function verify(reVerify = false) {
    setError("");
    if (!gstin.trim()) {
      setError("Enter a GSTIN to verify");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/integrations/gst/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gstin: gstin.trim(),
          entityType,
          entityId,
          persist: Boolean(entityType && entityId),
        }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "GST verification failed" });
        return;
      }
      const verified = (data as { data: Record<string, unknown> }).data;
      setMeta({
        verificationStatus: String(verified.verificationStatus ?? "VERIFIED"),
        verifiedAt: String(verified.verifiedAt ?? new Date().toISOString()),
        provider: String(verified.provider ?? "surepass"),
      });
      onVerified(verified);
      if (reVerify) setError("");
    } finally {
      setVerifying(false);
    }
  }

  const verified = isSuccessfulVerification(meta?.verificationStatus);
  const mockVerified = isMockVerification(meta?.verificationStatus);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        GSTIN{required ? " *" : ""}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={gstin}
          onChange={(e) => onGstinChange(e.target.value.toUpperCase())}
          disabled={disabled}
          placeholder="29AABCU9603R1ZL"
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || verifying}
          onClick={() => verify(Boolean(meta))}
        >
          {verifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : verified ? (
            "Re-verify"
          ) : (
            "Verify GST"
          )}
        </Button>
      </div>
      {verified && meta && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{mockVerified ? "Mock verification" : "Verified"}</p>
            {mockVerified && (
              <p className="text-emerald-700/80">Data generated locally for development.</p>
            )}
            <p>Provider: {meta.provider ?? "—"}</p>
            <p>
              Verified at:{" "}
              {meta.verifiedAt ? new Date(meta.verifiedAt).toLocaleString() : "—"}
            </p>
          </div>
        </div>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
