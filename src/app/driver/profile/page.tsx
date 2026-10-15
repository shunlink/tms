import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import DriverProfileForm from "@/components/forms/driver-profile-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { getDriverProfile } from "@/lib/queries";

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
    <div className="space-y-4">
      <Link href="/driver" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Current Trip
      </Link>

      <div>
        <h1 className="text-xl font-bold text-slate-900">My Profile & Documents</h1>
        <p className="text-sm text-slate-500">Complete your onboarding and upload documents</p>
      </div>

      <DriverProfileForm initial={initial} />

      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Required Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            Upload your driving license, PAN/Aadhaar and agreement.
          </p>
          <OnboardingDocuments
            endpoint="/api/portal/documents"
            documents={d.documents}
            allowedTypes={["LICENSE", "PAN", "AADHAAR", "AGREEMENT", "OTHER"]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
