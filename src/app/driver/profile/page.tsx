import { redirect } from "next/navigation";
import DriverProfileForm from "@/components/forms/driver-profile-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import { getSessionUser } from "@/lib/auth";
import { getDriverProfile } from "@/lib/queries";
import { driverPortalClasses } from "@/lib/driver-portal-theme";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DriverProfilePage() {
  const user = await getSessionUser();
  if (!user?.driverId) redirect("/login");

  const d = await getDriverProfile(user.driverId);
  if (!d) redirect("/driver");

  const initial = {
    name: d.name ?? "",
    phone: d.phone ?? "",
    dlNumber: d.dlNumber ?? "",
    dlExpiry: d.dlExpiry ? new Date(d.dlExpiry).toISOString().slice(0, 10) : "",
    address: d.address ?? "",
    city: d.city ?? "",
    state: d.state ?? "",
    pincode: d.pincode ?? "",
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-950">My profile & documents</h1>
        <p className="text-sm text-gray-600 mt-1">Complete onboarding and upload required documents</p>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-6 shadow-xs">
        <DriverProfileForm initial={initial} />
      </div>

      <div className={cn("rounded-2xl border bg-white shadow-xs overflow-hidden", driverPortalClasses.accentBorder)}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-950">Required documents</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload your driving license, PAN/Aadhaar and agreement.
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <OnboardingDocuments
            endpoint="/api/portal/documents"
            documents={d.documents}
            allowedTypes={["LICENSE", "PAN", "AADHAAR", "AGREEMENT", "OTHER"]}
          />
        </div>
      </div>
    </div>
  );
}
