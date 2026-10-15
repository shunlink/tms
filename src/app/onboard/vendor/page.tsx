import { redirect } from "next/navigation";
import PortalOnboardingVendorContent from "@/components/onboarding/portal-onboarding-vendor-content";
import { getSessionUser } from "@/lib/auth";
import { getVendorDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OnboardVendorPage() {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");
  if (user.role !== "VENDOR") redirect("/");
  if (!user.vendorId) redirect("/login");

  const v = await getVendorDetail(user.vendorId);
  if (!v) redirect("/login");
  if (v.onboardingStatus === "APPROVED") redirect("/portal/vendor");

  const initial = {
    name: v.name ?? "",
    type: v.type ?? "FLEET_OWNER",
    contactName: v.contactName ?? "",
    phone: v.phone ?? "",
    altPhone: v.altPhone ?? "",
    email: v.email ?? "",
    whatsapp: v.whatsapp ?? "",
    gstin: v.gstin ?? "",
    pan: v.pan ?? "",
    msme: v.msme ?? "",
    addressLine1: v.addressLine1 ?? "",
    addressLine2: v.addressLine2 ?? "",
    city: v.city ?? "",
    state: v.state ?? "",
    pincode: v.pincode ?? "",
    bankName: v.bankName ?? "",
    bankAccount: v.bankAccount ?? "",
    bankIfsc: v.bankIfsc ?? "",
    bankBranch: v.bankBranch ?? "",
    accountHolder: v.accountHolder ?? "",
    upiId: v.upiId ?? "",
    paymentTerms: v.paymentTerms != null ? String(v.paymentTerms) : "",
    notes: v.notes ?? "",
  };

  return (
    <PortalOnboardingVendorContent
      vendorId={v.id}
      entityName={v.name ?? "Vendor"}
      onboardingStatus={v.onboardingStatus}
      onboardingRemarks={v.onboardingRemarks}
      initial={initial}
      documents={v.documents}
      gstVerificationMeta={{
        verificationStatus: v.gstVerificationStatus,
        verifiedAt: v.gstVerifiedAt?.toISOString() ?? null,
        provider: v.gstVerificationProvider,
      }}
    />
  );
}
