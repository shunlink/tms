import { redirect } from "next/navigation";
import ClientForm from "@/components/forms/client-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import OnboardingSubmit from "@/components/forms/onboarding-submit";
import { CLIENT_ONBOARDING_DOCS, CLIENT_REQUIRED_DOCS } from "@/lib/onboarding-docs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PortalPageHeader from "@/components/portal/portal-page-header";
import { getSessionUser } from "@/lib/auth";
import { getClientDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login");

  const c = await getClientDetail(user.clientId);
  if (!c) redirect("/portal/client");

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
    creditLimit: c.creditLimit ? String(c.creditLimit) : "",
    paymentTerms: c.paymentTerms != null ? String(c.paymentTerms) : "",
    securityDeposit: c.securityDeposit ? String(c.securityDeposit) : "",
    bankName: c.bankName ?? "",
    bankAccount: c.bankAccount ?? "",
    bankIfsc: c.bankIfsc ?? "",
    bankBranch: c.bankBranch ?? "",
    accountHolder: c.accountHolder ?? "",
    notes: c.notes ?? "",
  };

  return (
    <div className="space-y-6">
      <PortalPageHeader
        accent="client"
        title="Profile & documents"
        description="Keep your company details and onboarding documents up to date"
      />

      <ClientForm
        initial={initial}
        endpoint="/api/portal/profile"
        submitLabel="Save Profile"
        variant="onboarding"
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle>Required documents</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground mb-4">
            Upload your GST certificate, PAN, MSME/Udyam, bank proof and agreement.
          </p>
          <OnboardingDocuments
            endpoint="/api/portal/documents"
            documents={c.documents}
            docTypes={CLIENT_ONBOARDING_DOCS}
          />
        </CardContent>
      </Card>

      {c.onboardingStatus === "REJECTED" && (
        <OnboardingSubmit
          status={c.onboardingStatus}
          documents={c.documents}
          requiredDocTypes={CLIENT_REQUIRED_DOCS}
        />
      )}
    </div>
  );
}
