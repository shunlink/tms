"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClientForm from "@/components/forms/client-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import ClientOnboardingAgreementPanel from "@/components/onboarding/client-onboarding-agreement-panel";
import { CLIENT_ONBOARDING_DOCS } from "@/lib/onboarding-docs";
import { businessTypeLabel } from "@/lib/client-business-types";
import { Button } from "@/components/ui/button";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type Doc = { id: string; type: string; url: string; name: string | null };

export default function OpsClientOnboardingCompletion({
  clientId,
  canComplete = true,
  initial,
  documents: initialDocuments,
  gstVerificationMeta,
  submittedSnapshot,
}: {
  clientId: string;
  canComplete?: boolean;
  initial: Record<string, string>;
  documents: Doc[];
  gstVerificationMeta?: {
    verificationStatus?: string | null;
    verifiedAt?: string | null;
    provider?: string | null;
  };
  submittedSnapshot: {
    pan: string | null;
    gstin: string | null;
    businessType: string | null;
    bankName: string | null;
    bankAccount: string | null;
    bankIfsc: string | null;
    accountHolder: string | null;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [documents, setDocuments] = useState(initialDocuments);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitForApproval() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/onboarding-requests/${clientId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Submit for approval failed" });
      return;
    }
    const status = (data as { status?: string })?.status;
    toast.push({
      title:
        status === "PENDING_APPROVAL"
          ? "Submitted for admin approval"
          : "Saved — still missing optional fields for full approval",
      variant: "success",
    });
    router.push("/onboarding-requests");
    router.refresh();
  }

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-1">
        <p className="font-medium text-slate-900">Submitted by client</p>
        <p>PAN: {submittedSnapshot.pan ?? "—"} · GST: {submittedSnapshot.gstin ?? "—"}</p>
        <p>Business type: {businessTypeLabel(submittedSnapshot.businessType)}</p>
        <p>
          Bank: {submittedSnapshot.bankName ?? "—"} · {submittedSnapshot.bankAccount ?? "—"} · IFSC{" "}
          {submittedSnapshot.bankIfsc ?? "—"} · {submittedSnapshot.accountHolder ?? "—"}
        </p>
      </div>

      <ClientForm
        initial={initial}
        clientId={clientId}
        variant="ops-completion"
        hideActions
        onValuesChange={setValues}
        gstVerificationMeta={gstVerificationMeta}
      />

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">KYC documents</h3>
        <OnboardingDocuments
          ownerType="client"
          ownerId={clientId}
          documents={documents.filter((d) => d.type !== "AGREEMENT")}
          docTypes={CLIENT_ONBOARDING_DOCS}
          onDocumentsChange={(next) => {
            const agreement = documents.filter((d) => d.type === "AGREEMENT");
            setDocuments([...next, ...agreement]);
          }}
        />
      </div>

      <ClientOnboardingAgreementPanel
        documents={documents}
        onDocumentsChange={setDocuments}
        ownerType="client"
        ownerId={clientId}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!canComplete && (
        <p className="text-sm text-slate-600 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          View only — only the assigned employee can submit this onboarding for approval.
        </p>
      )}

      {canComplete && (
        <Button type="button" onClick={submitForApproval} disabled={busy}>
          {busy ? "Submitting..." : "Submit for approval"}
        </Button>
      )}
    </div>
  );
}
