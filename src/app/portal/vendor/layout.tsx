import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import PortalAccessGuard from "@/components/portal-access-guard";
import PortalAccessBanner from "@/components/superadmin/portal-access-banner";
import OnboardingStatusBanner from "@/components/onboarding-status-banner";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/queries";
import { isProfileOnlyStatus, shouldCompleteOnboarding } from "@/lib/portal-access";

export default async function VendorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "VENDOR") redirect("/");
  if (!user.vendorId) redirect("/login");

  const onboarding = await getOnboardingStatus("VENDOR", user.vendorId);
  const status = onboarding?.onboardingStatus ?? "PENDING";

  if (shouldCompleteOnboarding(status)) {
    redirect("/onboard/vendor");
  }

  const profileOnly = isProfileOnlyStatus(status);
  const fullNav = [
    { href: "/portal/vendor", label: "Overview" },
    { href: "/portal/vendor/indents", label: "Open Indents", pendingCountKey: "vendorOpenIndents" as const },
    { href: "/portal/vendor/trips", label: "Assigned Trips", pendingCountKey: "vendorTrips" as const },
    { href: "/portal/vendor/payments", label: "Payments", pendingCountKey: "vendorPaymentsPortal" as const },
    { href: "/portal/vendor/profile", label: "Profile" },
  ];
  const navItems = profileOnly
    ? [{ href: "/portal/vendor/profile", label: "Profile" }]
    : fullNav;

  return (
    <>
      <PortalAccessBanner />
      {profileOnly && (
        <PortalAccessGuard
          profilePath="/portal/vendor/profile"
          onboardingStatus={status}
        />
      )}
      <PortalShell
        brand="Vendor Portal"
        subtitle={user.name ?? "Vendor"}
        userName={user.email ?? ""}
        navItems={navItems}
        accent="vendor"
      >
        {profileOnly && (
          <OnboardingStatusBanner
            status={status}
            remarks={onboarding?.onboardingRemarks}
          />
        )}
        {children}
      </PortalShell>
    </>
  );
}
