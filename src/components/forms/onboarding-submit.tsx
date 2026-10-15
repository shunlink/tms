"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasRequiredDocuments } from "./onboarding-documents";

type Doc = { id: string; type: string; url: string; name: string | null };

export default function OnboardingSubmit({
  status,
  documents = [],
  requiredDocTypes = ["GST", "PAN"],
}: {
  status: string;
  documents?: Doc[];
  requiredDocTypes?: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { ok, missing } = hasRequiredDocuments(documents, requiredDocTypes);

  async function submit() {
    if (!ok) {
      setError(`Please upload: ${missing.map((m) => m.replace(/_/g, " ")).join(", ")}`);
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/portal/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to submit. Please try again.");
      return;
    }
    router.refresh();
  }

  if (status === "SUBMITTED") {
    return (
      <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 flex gap-3">
        <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-900">Under admin review</p>
          <p className="text-sm text-amber-800 mt-1">
            Your onboarding has been submitted. Our team will verify your documents and approve your
            account — usually within 1 business day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900 mb-1">Ready to submit?</h3>
      <p className="text-sm text-slate-500 mb-4">
        Ensure all required documents are uploaded and your details are saved before submitting.
      </p>

      {!ok && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Missing: {missing.join(", ")}
        </p>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <Button onClick={submit} disabled={busy || !ok} className="rounded-xl gap-2">
        <Send className="h-4 w-4" />
        {busy ? "Submitting..." : "Submit for approval"}
      </Button>
    </div>
  );
}
