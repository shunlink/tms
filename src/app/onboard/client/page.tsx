import { redirect } from "next/navigation";
import PortalOnboardingClientContent from "@/components/onboarding/portal-onboarding-client-content";
import { getSessionUser } from "@/lib/auth";
import { clientOnboardEntryPath } from "@/lib/client-onboarding";
import { getClientDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OnboardClientPage() {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");
  if (user.role !== "CLIENT") redirect("/");
  if (!user.clientId) redirect("/login");

  const c = await getClientDetail(user.clientId);
  if (!c) redirect("/login");
  if (c.onboardingStatus === "APPROVED") redirect("/portal/client");

  const target = clientOnboardEntryPath(c.onboardingStatus);
  if (target !== "/onboard/client") redirect(target);

  const initial = {
    name: c.name ?? "",
    businessType: c.businessType ?? "",
    industry: c.industry ?? "",
    website: c.website ?? "",
    gstin: c.gstin ?? "",
    pan: c.pan ?? "",
    cin: c.cin ?? "",
    msme: c.msme ?? "",
    contactName: c.contactName ?? "",
    phone: c.phone ?? "",
    altPhone: c.altPhone ?? "",
    email: c.email ?? "",
    accountsEmail: c.accountsEmail ?? "",
    billingAddress: c.billingAddress ?? "",
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    pincode: c.pincode ?? "",
    country: c.country ?? "India",
    shippingAddress: c.shippingAddress ?? "",
    shippingCity: c.shippingCity ?? "",
    shippingState: c.shippingState ?? "",
    shippingPincode: c.shippingPincode ?? "",
    bankName: c.bankName ?? "",
    bankAccount: c.bankAccount ?? "",
    bankIfsc: c.bankIfsc ?? "",
    bankBranch: c.bankBranch ?? "",
    accountHolder: c.accountHolder ?? "",
    notes: c.notes ?? "",
  };

  return (
    <PortalOnboardingClientContent
      clientId={c.id}
      entityName={c.name ?? "Client"}
      onboardingStatus={c.onboardingStatus}
      onboardingRemarks={c.onboardingRemarks}
      initial={initial}
      documents={c.documents}
      gstVerificationMeta={{
        verificationStatus: c.gstVerificationStatus,
        verifiedAt: c.gstVerifiedAt?.toISOString() ?? null,
        provider: c.gstVerificationProvider,
      }}
    />
  );
}
