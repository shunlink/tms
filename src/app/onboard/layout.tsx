import { redirect } from "next/navigation";
import PortalOnboardingShell from "@/components/onboarding/portal-onboarding-shell";
import { getSessionUser } from "@/lib/auth";
import { getClientDetail, getVendorDetail } from "@/lib/queries";

export default async function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");

  if (user.role === "CLIENT" && user.clientId) {
    const c = await getClientDetail(user.clientId);
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
