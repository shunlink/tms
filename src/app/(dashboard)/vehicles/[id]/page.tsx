import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import { getVehicleDetail } from "@/lib/queries";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm border-b last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value || "—"}</span>
    </div>
  );
}

export default async function VehicleDetailPage({ params }: { params: { id: string } }) {
  const v = await getVehicleDetail(params.id);
  if (!v) notFound();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Link href="/vehicles" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Vehicles
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{v.number}</h1>
          <p className="text-slate-500">
            {v.type.replace(/_/g, " ")}
            {v.capacity ? ` · ${v.capacity}` : ""} · {v.vendor?.name ?? "—"}
          </p>
        </div>
        <Link href={`/vehicles/${v.id}/edit`} className="inline-flex items-center gap-2 text-sm border rounded-md px-3 h-9 hover:bg-slate-50">
          <Pencil className="h-4 w-4" /> Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Vehicle</CardTitle></CardHeader>
          <CardContent>
            <Row label="Owner (Vendor)" value={v.vendor ? <Link href={`/vendors/${v.vendor.id}`} className="text-blue-600 hover:underline">{v.vendor.name}</Link> : "—"} />
            <Row label="Body Type" value={v.bodyType} />
            <Row label="Make / Model" value={[v.make, v.model].filter(Boolean).join(" ")} />
            <Row label="Year" value={v.year} />
            <Row label="Capacity" value={v.capacity} />
            <Row label="Capacity (tons)" value={v.capacityTons} />
            <Row label="Ownership" value={v.ownership} />
            <Row label="Trips" value={String(v.counts.trips)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Registration</CardTitle></CardHeader>
          <CardContent>
            <Row label="RC Number" value={v.rcNumber} />
            <Row label="RC Expiry" value={formatDate(v.rcExpiry)} />
            <Row label="Owner Name" value={v.ownerName} />
            <Row label="Owner PAN" value={v.ownerPan} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Insurance</CardTitle></CardHeader>
          <CardContent>
            <Row label="Policy Number" value={v.insuranceNumber} />
            <Row label="Company" value={v.insuranceCompany} />
            <Row label="Expiry" value={formatDate(v.insuranceExpiry)} />
            <Row label="IDV" value={v.insuranceValue ? formatINR(v.insuranceValue) : ""} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Fitness, PUC & Permit</CardTitle></CardHeader>
          <CardContent>
            <Row label="Fitness Expiry" value={formatDate(v.fitnessExpiry)} />
            <Row label="PUC Number" value={v.pucNumber} />
            <Row label="PUC Expiry" value={formatDate(v.pucExpiry)} />
            <Row label="Permit Type" value={v.permitType} />
            <Row label="Permit Number" value={v.permitNumber} />
            <Row label="Permit Expiry" value={formatDate(v.permitExpiry)} />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Telematics</CardTitle></CardHeader>
        <CardContent>
          <Row label="GPS Enabled" value={v.gpsEnabled ? "Yes" : "No"} />
          <Row label="GPS Device ID" value={v.gpsDeviceId} />
          <Row label="FASTag ID" value={v.fastagId} />
          <Row label="Remarks" value={v.remarks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent>
          <OnboardingDocuments
            ownerType="vehicle"
            ownerId={v.id}
            documents={v.documents}
            allowedTypes={["RC", "INSURANCE", "FITNESS", "PUC", "PERMIT", "OTHER"]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
