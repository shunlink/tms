import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy URL — onboarding no longer has a preference chooser. */
export default function ClientOnboardingChoosePage() {
  redirect("/onboard/client");
}
