import { redirect } from "next/navigation";
import VendorForm from "@/components/forms/vendor-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import OnboardingSubmit from "@/components/forms/onboarding-submit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { getVendorDetail } from "@/lib/queries";
import { VENDOR_ONBOARDING_DOCS, VENDOR_REQUIRED_DOCS } from "@/lib/onboarding-docs";

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
    <div className="space-y-8">
      {v.onboardingStatus === "REJECTED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <strong>Submission rejected.</strong>
          {v.onboardingRemarks ? ` ${v.onboardingRemarks}` : " Please update and re-submit."}
        </div>
      )}

      <VendorForm
        initial={initial}
        vendorId={v.id}
        endpoint="/api/portal/profile"
        submitLabel="Save & continue"
        lockSignupFields
        gstVerificationMeta={{
          verificationStatus: v.gstVerificationStatus,
          verifiedAt: v.gstVerifiedAt?.toISOString() ?? null,
          provider: v.gstVerificationProvider,
        }}
      />

      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
          <CardTitle className="text-base">Fleet compliance documents</CardTitle>
          <p className="text-sm text-slate-500 font-normal mt-1">
            GST certificate and PAN are mandatory for transporter verification.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <OnboardingDocuments
            endpoint="/api/portal/documents"
            documents={v.documents}
            docTypes={VENDOR_ONBOARDING_DOCS}
          />
        </CardContent>
      </Card>

      <OnboardingSubmit
        status={v.onboardingStatus}
        documents={v.documents}
        requiredDocTypes={VENDOR_REQUIRED_DOCS}
      />
    </div>
  );
}
