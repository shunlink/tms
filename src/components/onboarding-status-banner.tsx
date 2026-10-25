import { AlertTriangle, Clock, Eye } from "lucide-react";
import { ONBOARDING_CASE_STATUS } from "@/lib/onboarding-case-status";

export default function OnboardingStatusBanner({
  status,
  remarks,
}: {
  status: string;
  remarks?: string | null;
}) {
  if (status === ONBOARDING_CASE_STATUS.REJECTED) {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex gap-3">
        <AlertTriangle className="h-6 w-6 text-red-700 shrink-0 mt-0.5" />
        <div className="text-base text-red-800">
          <p className="font-semibold">Action required</p>
          <p className="mt-1">
            Your onboarding was rejected
            {remarks ? `: ${remarks}` : "."} Please update your details and re-submit from onboarding.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex gap-3">
      <Eye className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
      <div className="text-base text-amber-900">
        <p className="font-semibold">View-only access</p>
        <p className="mt-1 text-amber-800">
          Your onboarding is under review ({status.replace(/_/g, " ").toLowerCase()}). You can browse
          shipments, requirements, and invoices, and view your profile. Creating or editing records is
          disabled until an administrator approves your account.
        </p>
      </div>
    </div>
  );
}
