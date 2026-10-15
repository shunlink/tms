"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, X, ShieldCheck, Loader2 } from "lucide-react";
import OnboardingReviewSnapshot, {
  type OnboardingApplicationSnapshot,
} from "@/components/forms/onboarding-review-snapshot";

export default function OnboardingActions({
  type,
  id,
  name,
}: {
  type: string;
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<OnboardingApplicationSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openReview() {
    setOpen(true);
    setSnapshot(null);
    setLoading(true);
    setError("");
    setRemarks("");
    try {
      const res = await fetch(`/api/onboarding/${type}/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to load application");
        return;
      }
      const data = await res.json();
      setSnapshot(data);
    } catch {
      setError("Failed to load application");
    } finally {
      setLoading(false);
    }
  }

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/onboarding/${type}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, remarks: remarks || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openReview}
        className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <Eye className="h-3.5 w-3.5" /> Review
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Application Review</h3>
                <p className="text-sm text-slate-600">{name}</p>
                <p className="text-xs text-slate-500 capitalize">{type} onboarding verification</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/30">
              {loading && (
                <p className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading application…
                </p>
              )}

              {!loading && error && !snapshot && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {!loading && snapshot && (
                <OnboardingReviewSnapshot snapshot={snapshot} />
              )}
            </div>

            <div className="border-t px-5 py-4 shrink-0 bg-white">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Remarks (optional)
              </label>
              <textarea
                className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Reason for approval or rejection…"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              {error && snapshot && <p className="mb-2 text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => decide("approve")}
                  disabled={busy || loading || !snapshot}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide("reject")}
                  disabled={busy || loading || !snapshot}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
