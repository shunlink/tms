import { redirect } from "next/navigation";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import PortalPageHeader from "@/components/portal/portal-page-header";
import PortalSectionCard from "@/components/portal/portal-section-card";
import PortalVendorProfileView from "@/components/portal/portal-vendor-profile-view";
import { getSessionUser } from "@/lib/auth";
import { VENDOR_ONBOARDING_DOCS } from "@/lib/onboarding-docs";
import { getVendorDetail } from "@/lib/queries";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VendorProfilePage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login");

  const v = await getVendorDetail(user.vendorId);
  if (!v) redirect("/portal/vendor");

  return (
    <div className="space-y-6">
      <PortalPageHeader
        accent="vendor"
        title="Profile & documents"
        description="Your fleet details and compliance documents on file with ShunLink"
      />

      <PortalVendorProfileView vendor={v} />

      <PortalSectionCard
        title="Documents"
        description="Certificates and agreements submitted during onboarding"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent mb-4">
          <FileText className="h-4 w-4" aria-hidden />
        </div>
        <OnboardingDocuments
          documents={v.documents}
          docTypes={VENDOR_ONBOARDING_DOCS}
          readOnly
          allowDelete={false}
        />
      </PortalSectionCard>
    </div>
  );
}
