import { redirect } from "next/navigation";
import OnboardingShell from "@/components/onboarding/onboarding-shell";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/queries";

export default async function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");

  const roleLabel =
    user.role === "CLIENT"
      ? "Client"
      : user.role === "VENDOR"
        ? "Vendor"
        : "Account";

  let status = "PENDING";
  if (user.role === "CLIENT" && user.clientId) {
    const ob = await getOnboardingStatus("CLIENT", user.clientId);
    status = ob?.onboardingStatus ?? "PENDING";
  } else if (user.role === "VENDOR" && user.vendorId) {
    const ob = await getOnboardingStatus("VENDOR", user.vendorId);
    status = ob?.onboardingStatus ?? "PENDING";
  }

  return (
    <OnboardingShell
      roleLabel={roleLabel}
      userName={user.name ?? user.email ?? ""}
      status={status}
    >
      {children}
    </OnboardingShell>
  );
}
