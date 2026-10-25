"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasRequiredDocuments } from "./onboarding-documents";
import OnboardingSubmitConfirmModal from "./onboarding-submit-confirm-modal";
import { savePortalProfileDraft } from "@/lib/portal-profile-save";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import { validateClientOnboardingMandatoryProfile } from "@/lib/client-onboarding-fields";
import { ONBOARDING_CASE_STATUS } from "@/lib/onboarding-case-status";

type Doc = { id: string; type: string; url: string; name: string | null };

export function OnboardingSubmittedBanner() {
  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 flex gap-3">
      <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-amber-900">Under admin review</p>
        <p className="text-sm text-amber-800 mt-1">
          Your onboarding has been submitted. Our team will verify your documents and approve your account
          — usually within 1 business day.
        </p>
      </div>
    </div>
  );
}

export default function OnboardingSubmit({
  status,
  documents = [],
  requiredDocTypes = ["GST", "PAN"],
  variant = "default",
  placement = "card",
  profileValues,
}: {
  status: string;
  documents?: Doc[];
  requiredDocTypes?: string[];
  variant?: "default" | "portal";
  /** Inline card (default) or fixed footer action bar */
  placement?: "card" | "footer";
  /** Latest form values — saved before submit when provided */
  profileValues?: Record<string, string>;
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { ok, missing } = hasRequiredDocuments(documents, requiredDocTypes);

  function mandatoryProfileError(): string | null {
    if (!profileValues) return null;
    const { ok: profileOk, errors } = validateClientOnboardingMandatoryProfile(profileValues);
    if (profileOk) return null;
    return errors[0] ?? "Please complete GST, PAN, and bank details.";
  }

  async function submitForApproval() {
    if (!ok) {
      setError(`Please upload: ${missing.map((m) => m.replace(/_/g, " ")).join(", ")}`);
      return;
    }
    const profileErr = mandatoryProfileError();
    if (profileErr) {
      setError(profileErr);
      return;
    }
    if (profileValues && "deliveryZones" in profileValues) {
      const zones = profileValues.deliveryZones?.split(",").map((z) => z.trim()).filter(Boolean) ?? [];
      if (zones.length === 0) {
        setError("Select at least one delivery zone before submitting.");
        return;
      }
    }
    setBusy(true);
    setError("");

    if (profileValues) {
      const saved = await savePortalProfileDraft(profileValues);
      if (!saved.ok) {
        setBusy(false);
        setError(saved.error || "Failed to save your details. Please try again.");
        return;
      }
    }

    const res = await fetch("/api/portal/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to submit. Please try again." });
      return;
    }
    setConfirmOpen(false);
    router.push("/portal/client");
    router.refresh();
  }

  function openConfirm() {
    if (!ok) {
      setError(`Please upload: ${missing.map((m) => m.replace(/_/g, " ")).join(", ")}`);
      return;
    }
    const profileErr = mandatoryProfileError();
    if (profileErr) {
      setError(profileErr);
      return;
    }
    if (profileValues && "deliveryZones" in profileValues) {
      const zones = profileValues.deliveryZones?.split(",").map((z) => z.trim()).filter(Boolean) ?? [];
      if (zones.length === 0) {
        setError("Select at least one delivery zone before submitting.");
        return;
      }
    }
    setError("");
    setConfirmOpen(true);
  }

  if (
    status === ONBOARDING_CASE_STATUS.SUBMITTED ||
    status === ONBOARDING_CASE_STATUS.PENDING_APPROVAL ||
    status === ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION
  ) {
    return <OnboardingSubmittedBanner />;
  }

  if (placement === "footer") {
    return (
      <>
        <OnboardingSubmitConfirmModal
          open={confirmOpen}
          busy={busy}
          onCancel={() => !busy && setConfirmOpen(false)}
          onContinue={() => void submitForApproval()}
        />
        <div
          className="fixed bottom-0 left-0 right-0 z-30 lg:left-[220px] bg-[#F4F6F9]/95 backdrop-blur border-t border-slate-200/80 px-4 sm:px-8 py-4 flex justify-end"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto sm:justify-end">
            {error && <p className="text-sm text-red-600 sm:mr-auto">{error}</p>}
            {!ok && !error && (
              <p className="text-sm text-amber-800 sm:mr-auto flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Missing documents: {missing.join(", ")}
              </p>
            )}
            {ok && mandatoryProfileError() && !error && (
              <p className="text-sm text-amber-800 sm:mr-auto flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {mandatoryProfileError()}
              </p>
            )}
            <Button
              type="button"
              onClick={openConfirm}
              disabled={busy || !ok || Boolean(mandatoryProfileError())}
              className="rounded-xl gap-2 bg-[#0F172A] hover:bg-slate-800 px-6"
            >
              <Send className="h-4 w-4" />
              {busy ? "Submitting..." : "Submit for approval"}
            </Button>
          </div>
        </div>
      </>
    );
  }

  const shellClass =
    variant === "portal"
      ? "rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm"
      : "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

  return (
    <>
      <OnboardingSubmitConfirmModal
        open={confirmOpen}
        busy={busy}
        onCancel={() => !busy && setConfirmOpen(false)}
        onContinue={() => void submitForApproval()}
      />
      <div className={shellClass}>
        <h3 className="font-semibold text-slate-900 mb-1">Ready to submit?</h3>
        <p className="text-sm text-slate-500 mb-4">
          Ensure all required documents are uploaded and your details are saved before submitting for admin
          review.
        </p>

        {!ok && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Missing: {missing.join(", ")}
          </p>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <Button
          type="button"
          onClick={openConfirm}
          disabled={busy || !ok}
          className={`rounded-xl gap-2 ${variant === "portal" ? "bg-[#0F172A] hover:bg-slate-800" : ""}`}
        >
          <Send className="h-4 w-4" />
          {busy ? "Submitting..." : "Submit for approval"}
        </Button>
      </div>
    </>
  );
}
