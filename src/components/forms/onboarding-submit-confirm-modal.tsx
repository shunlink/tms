"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OnboardingSubmitConfirmModal({
  open,
  busy,
  onCancel,
  onContinue,
}: {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center p-4 sm:p-6"
      style={{ width: "100vw", height: "100dvh" }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onCancel} aria-hidden />
      <div
        className="relative z-10 w-full max-w-md rounded-xl border bg-white shadow-xl mx-auto"
        role="dialog"
        aria-labelledby="onboarding-submit-confirm-title"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div className="flex gap-3 items-start min-w-0 flex-1 pr-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden />
            </div>
            <div>
              <h2 id="onboarding-submit-confirm-title" className="text-lg font-semibold text-slate-900">
                Submit for approval?
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                You cannot change your details after submission. Our team will review your profile and
                documents. You can still view everything while your application is under review.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-[#0F172A] hover:bg-slate-800"
            onClick={onContinue}
            disabled={busy}
          >
            {busy ? "Submitting..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
