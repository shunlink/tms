import { redirect } from "next/navigation";
import PortalAccessGuard from "@/components/portal-access-guard";
import PortalAccessBanner from "@/components/superadmin/portal-access-banner";
import OnboardingStatusBanner from "@/components/onboarding-status-banner";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/queries";
import { isProfileOnlyStatus, shouldCompleteOnboarding } from "@/lib/portal-access";
import { prisma } from "@/lib/prisma";
import VendorPortalShell from "@/components/vendor-portal-shell";

export default async function VendorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?portal=transporter");
  if (user.role !== "VENDOR") redirect("/");
  if (!user.vendorId) redirect("/login?portal=transporter");

  const [onboarding, vendor] = await Promise.all([
    getOnboardingStatus("VENDOR", user.vendorId),
    prisma.vendor.findFirst({ where: { id: user.vendorId }, select: { name: true } }),
  ]);
  const status = onboarding?.onboardingStatus ?? "PENDING";
  const vendorName = vendor?.name || user.name || "Sharma Transport";

  if (shouldCompleteOnboarding(status)) {
    redirect("/onboard/vendor");
  }

  const profileOnly = isProfileOnlyStatus(status);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#F4F6F9]">
      <PortalAccessBanner />
      {profileOnly && (
        <PortalAccessGuard
          profilePath="/portal/vendor/profile"
          onboardingStatus={status}
        />
      )}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <VendorPortalShell
          vendorName={vendorName}
          userName={user.email ?? ""}
        >
          {profileOnly && (
            <OnboardingStatusBanner
              status={status}
              remarks={onboarding?.onboardingRemarks}
            />
          )}
          {children}
        </VendorPortalShell>
      </div>
    </div>
  );
}
