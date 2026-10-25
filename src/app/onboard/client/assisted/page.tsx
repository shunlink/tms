import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy URL — assisted onboarding merged into the single client form. */
export default function ClientAssistedOnboardingPage() {
  redirect("/onboard/client");
}
