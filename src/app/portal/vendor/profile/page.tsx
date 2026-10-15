import { redirect } from "next/navigation";
import VendorForm from "@/components/forms/vendor-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PortalPageHeader from "@/components/portal/portal-page-header";
import { getSessionUser } from "@/lib/auth";
import { getVendorDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function VendorProfilePage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login");

  const v = await getVendorDetail(user.vendorId);
  if (!v) redirect("/portal/vendor");

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
    <div className="space-y-6">
      <PortalPageHeader
        accent="vendor"
        title="Profile & documents"
        description="Keep your fleet details and onboarding documents up to date"
      />

      <VendorForm initial={initial} endpoint="/api/portal/profile" submitLabel="Save Profile" />

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
            documents={v.documents}
            allowedTypes={["GST", "PAN", "MSME", "BANK_PROOF", "AGREEMENT", "OTHER"]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
