import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import PortalAccessBanner from "@/components/superadmin/portal-access-banner";
import OnboardingStatusBanner from "@/components/onboarding-status-banner";
import { ClientPortalViewOnlyProvider } from "@/components/portal/client-portal-view-only-context";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/queries";
import { isClientPortalViewOnly, shouldCompleteOnboarding } from "@/lib/portal-access";
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

  const viewOnly = isClientPortalViewOnly(status);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#F4F6F9]">
      <PortalAccessBanner />
      <ClientPortalViewOnlyProvider viewOnly={viewOnly}>
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <ClientPortalShell
            clientName={clientName}
            userName={user.email ?? ""}
            viewOnly={viewOnly}
          >
            {viewOnly && (
              <OnboardingStatusBanner
                status={status}
                remarks={onboarding?.onboardingRemarks}
              />
            )}
            {children}
          </ClientPortalShell>
        </div>
      </ClientPortalViewOnlyProvider>
    </div>
  );
}
