import { AlertTriangle, Clock } from "lucide-react";

export default function OnboardingStatusBanner({
  status,
  remarks,
}: {
  status: string;
  remarks?: string | null;
}) {
  if (status === "SUBMITTED") {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex gap-3">
        <Clock className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-base text-amber-900">
          <p className="font-semibold">Under review</p>
          <p className="mt-1 text-amber-800">
            Your account is pending admin approval. You can update your profile and documents while you wait.
          </p>
        </div>
      </div>
    );
  }
  if (status === "REJECTED") {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex gap-3">
        <AlertTriangle className="h-6 w-6 text-red-700 shrink-0 mt-0.5" />
        <div className="text-base text-red-800">
          <p className="font-semibold">Action required</p>
          <p className="mt-1">
            Your onboarding was rejected
            {remarks ? `: ${remarks}` : "."} Please update your details and re-submit.
          </p>
        </div>
      </div>
    );
  }
  return null;
}
