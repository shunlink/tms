import { redirect } from "next/navigation";
import ClientForm from "@/components/forms/client-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import OnboardingSubmit from "@/components/forms/onboarding-submit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { getClientDetail } from "@/lib/queries";
import { CLIENT_ONBOARDING_DOCS, CLIENT_REQUIRED_DOCS } from "@/lib/onboarding-docs";

export const dynamic = "force-dynamic";

export default async function OnboardClientPage() {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");
  if (user.role !== "CLIENT") redirect("/");
  if (!user.clientId) redirect("/login");

  const c = await getClientDetail(user.clientId);
  if (!c) redirect("/login");
  if (c.onboardingStatus === "APPROVED") redirect("/portal/client");

  const initial = {
    name: c.name ?? "",
    legalName: c.legalName ?? "",
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
    <div className="space-y-8">
      {c.onboardingStatus === "REJECTED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <strong>Submission rejected.</strong>
          {c.onboardingRemarks ? ` ${c.onboardingRemarks}` : " Please update your details and re-submit."}
        </div>
      )}

      <ClientForm
        initial={initial}
        clientId={c.id}
        endpoint="/api/portal/profile"
        submitLabel="Save & continue"
        variant="onboarding"
        lockSignupFields
        gstVerificationMeta={{
          verificationStatus: c.gstVerificationStatus,
          verifiedAt: c.gstVerifiedAt?.toISOString() ?? null,
          provider: c.gstVerificationProvider,
        }}
      />

      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <CardTitle className="text-base">Required documents</CardTitle>
          <p className="text-sm text-slate-500 font-normal mt-1">
            GST certificate and PAN card are mandatory. Other documents help speed up approval.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <OnboardingDocuments
            endpoint="/api/portal/documents"
            documents={c.documents}
            docTypes={CLIENT_ONBOARDING_DOCS}
          />
        </CardContent>
      </Card>

      <OnboardingSubmit
        status={c.onboardingStatus}
        documents={c.documents}
        requiredDocTypes={CLIENT_REQUIRED_DOCS}
      />
    </div>
  );
}
