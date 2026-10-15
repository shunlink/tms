import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import PortalAccessGuard from "@/components/portal-access-guard";
import PortalAccessBanner from "@/components/superadmin/portal-access-banner";
import OnboardingStatusBanner from "@/components/onboarding-status-banner";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/queries";
import { isProfileOnlyStatus, shouldCompleteOnboarding } from "@/lib/portal-access";
import { prisma } from "@/lib/prisma";
import ClientPortalShell from "@/components/client-portal-shell";

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?portal=client");
  if (user.role !== "CLIENT") redirect("/");
  if (!user.clientId) redirect("/login?portal=client");

  const [onboarding, client] = await Promise.all([
    getOnboardingStatus("CLIENT", user.clientId),
    prisma.client.findFirst({ where: { id: user.clientId }, select: { name: true } }),
  ]);
  const status = onboarding?.onboardingStatus ?? "PENDING";
  const clientName = client?.name || user.name || "Client";

  if (shouldCompleteOnboarding(status)) {
    redirect("/onboard/client");
  }

  const profileOnly = isProfileOnlyStatus(status);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#F4F6F9]">
      <PortalAccessBanner />
      {profileOnly && (
        <PortalAccessGuard
          profilePath="/portal/client/profile"
          onboardingStatus={status}
        />
      )}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <ClientPortalShell
          clientName={clientName}
          userName={user.email ?? ""}
        >
          {profileOnly && (
            <OnboardingStatusBanner
              status={status}
              remarks={onboarding?.onboardingRemarks}
            />
          )}
          {children}
        </ClientPortalShell>
      </div>
    </div>
  );
}
