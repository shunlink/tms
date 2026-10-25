import { redirect } from "next/navigation";
import { User, FileText, ShieldCheck } from "lucide-react";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import PortalVendorProfileView from "@/components/portal/portal-vendor-profile-view";
import { getSessionUser } from "@/lib/auth";
import { VENDOR_ONBOARDING_DOCS } from "@/lib/onboarding-docs";
import { getVendorDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function VendorProfilePage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login?portal=transporter");

  const v = await getVendorDetail(user.vendorId);
  if (!v) redirect("/portal/vendor");

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Profile & Documents
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Your fleet company identity, banking details and compliance records verified with ShunLink.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60">
          <ShieldCheck className="h-4 w-4" />
          <span>Verified Partner</span>
        </div>
      </div>

      <PortalVendorProfileView vendor={v} />

      {/* KYC Documents Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100/60">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-950">Compliance Documents</h2>
            <p className="text-xs text-gray-500">
              Certificates, agreements and identity proofs submitted during partner onboarding.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <OnboardingDocuments
            documents={v.documents}
            docTypes={VENDOR_ONBOARDING_DOCS}
            readOnly
            allowDelete={false}
          />
        </div>
      </div>
    </div>
  );
}
