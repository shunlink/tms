"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

export default function ClientOnboardingChoose() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"SELF" | "SHUNLINK" | null>(null);
  const [error, setError] = useState("");

  async function choose(preference: "SELF" | "SHUNLINK") {
    setBusy(preference);
    setError("");
    const res = await fetch("/api/portal/onboarding/preference", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preference }),
    });
    setBusy(null);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Could not save your choice" });
      return;
    }
    router.push(preference === "SELF" ? "/onboard/client" : "/onboard/client/assisted");
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">How would you like to onboard?</h1>
        <p className="text-slate-600 mt-2 text-sm">
          Choose self-service KYC or let our operations team guide you through setup.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => choose("SELF")}
          disabled={busy !== null}
          className="text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-amber-400 hover:shadow-md transition-all disabled:opacity-60"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 mb-4">
            <Building2 className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-slate-900">Self onboarding</h2>
          <p className="text-sm text-slate-600 mt-2">
            Complete the full company profile, compliance details, and document uploads yourself.
          </p>
          <Button className="mt-5" disabled={busy !== null}>
            {busy === "SELF" ? "Starting..." : "Continue"}
          </Button>
        </button>

        <button
          type="button"
          onClick={() => choose("SHUNLINK")}
          disabled={busy !== null}
          className="text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all disabled:opacity-60"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 mb-4">
            <Headphones className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-slate-900">Onboarded by Shunlink</h2>
          <p className="text-sm text-slate-600 mt-2">
            Share PAN, GST, and bank details now. Our team will call you to finish KYC and documents.
          </p>
          <Button variant="outline" className="mt-5" disabled={busy !== null}>
            {busy === "SHUNLINK" ? "Starting..." : "Continue"}
          </Button>
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
