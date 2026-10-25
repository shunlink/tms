import { redirect } from "next/navigation";
import PortalOnboardingShell from "@/components/onboarding/portal-onboarding-shell";
import { getSessionUser } from "@/lib/auth";
import { getClientDetail, getOnboardingStatus, getVendorDetail } from "@/lib/queries";
import { portalHomeForRole, shouldCompleteOnboarding } from "@/lib/portal-access";

export default async function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");

  if (user.role === "CLIENT" && user.clientId) {
    const c = await getClientDetail(user.clientId);
    const status = c?.onboardingStatus ?? "PENDING";
    if (status === "APPROVED" || !shouldCompleteOnboarding(status)) {
      redirect(portalHomeForRole("CLIENT", status, c?.onboardingPreference ?? null));
    }
    return (
      <PortalOnboardingShell
        kind="client"
        entityName={c?.name ?? user.name ?? "Client"}
        userEmail={user.email ?? ""}
      >
        {children}
      </PortalOnboardingShell>
    );
  }

  if (user.role === "VENDOR" && user.vendorId) {
    const onboarding = await getOnboardingStatus("VENDOR", user.vendorId);
    const status = onboarding?.onboardingStatus ?? "PENDING";
    if (status === "APPROVED" || status === "SUBMITTED") {
      redirect(portalHomeForRole("VENDOR", status));
    }

    const v = await getVendorDetail(user.vendorId);
    return (
      <PortalOnboardingShell
        kind="vendor"
        entityName={v?.name ?? user.name ?? "Vendor"}
        userEmail={user.email ?? ""}
      >
        {children}
      </PortalOnboardingShell>
    );
  }

  redirect("/login");
}
