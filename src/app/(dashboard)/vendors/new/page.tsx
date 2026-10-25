import PartnerVendorCreateFlow from "@/components/partners/partner-vendor-create-flow";
import { requirePagePermission } from "@/lib/page-auth";

export default async function NewVendorPage() {
  await requirePagePermission("vendor.edit");
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Add Vendor</h1>
        <p className="text-slate-500">
          Onboard a transporter with profile, documents, and portal credentials aligned to vendor self-service onboarding.
        </p>
      </div>
      <PartnerVendorCreateFlow />
    </div>
  );
}
