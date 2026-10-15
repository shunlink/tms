import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import PortalAccessGuard from "@/components/portal-access-guard";
import PortalAccessBanner from "@/components/superadmin/portal-access-banner";
import OnboardingStatusBanner from "@/components/onboarding-status-banner";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/queries";
import { isProfileOnlyStatus, shouldCompleteOnboarding } from "@/lib/portal-access";

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "CLIENT") redirect("/");
  if (!user.clientId) redirect("/login");

  const onboarding = await getOnboardingStatus("CLIENT", user.clientId);
  const status = onboarding?.onboardingStatus ?? "PENDING";

  if (shouldCompleteOnboarding(status)) {
    redirect("/onboard/client");
  }

  const profileOnly = isProfileOnlyStatus(status);
  const fullNav = [
    { href: "/portal/client", label: "Overview" },
    { href: "/portal/client/trips", label: "My Trips" },
    { href: "/portal/client/requirements", label: "Requirements" },
    { href: "/portal/client/invoices", label: "Invoices", pendingCountKey: "clientInvoices" as const },
    { href: "/portal/client/profile", label: "Profile & Docs" },
  ];
  const navItems = profileOnly
    ? [{ href: "/portal/client/profile", label: "Profile & Docs" }]
    : fullNav;

  return (
    <>
      <PortalAccessBanner />
      {profileOnly && (
        <PortalAccessGuard
          profilePath="/portal/client/profile"
          onboardingStatus={status}
        />
      )}
      <PortalShell
        brand="Client Portal"
        subtitle={user.name ?? "Client"}
        userName={user.email ?? ""}
        navItems={navItems}
        accent="client"
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
