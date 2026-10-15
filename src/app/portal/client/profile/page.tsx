import { redirect } from "next/navigation";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import PortalClientProfileView from "@/components/portal/portal-client-profile-view";
import PortalPageHeader from "@/components/portal/portal-page-header";
import PortalSectionCard from "@/components/portal/portal-section-card";
import { getSessionUser } from "@/lib/auth";
import { CLIENT_ONBOARDING_DOCS } from "@/lib/onboarding-docs";
import { getClientDetail } from "@/lib/queries";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login");

  const c = await getClientDetail(user.clientId);
  if (!c) redirect("/portal/client");

  return (
    <div className="space-y-6">
      <PortalPageHeader
        accent="client"
        title="Profile & documents"
        description="Your company details and onboarding documents on file with ShunLink"
      />

      <PortalClientProfileView client={c} />

      <PortalSectionCard
        title="Documents"
        description="Certificates and agreements submitted during onboarding"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 mb-4">
          <FileText className="h-4 w-4" aria-hidden />
        </div>
        <OnboardingDocuments
          documents={c.documents}
          docTypes={CLIENT_ONBOARDING_DOCS}
          readOnly
          allowDelete={false}
        />
      </PortalSectionCard>
    </div>
  );
}
