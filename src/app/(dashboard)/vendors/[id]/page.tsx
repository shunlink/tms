import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import { getVendorDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm border-b last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value || "—"}</span>
    </div>
  );
}

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const v = await getVendorDetail(params.id);
  if (!v) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/vendors" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Vendors
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{v.name}</h1>
          <p className="text-slate-500">
            {v.type === "FLEET_OWNER" ? "Fleet Owner" : "Broker"}
            {v.rating ? ` · ★ ${v.rating.toFixed(1)}` : ""}
          </p>
        </div>
        <Link href={`/vendors/${v.id}/edit`} className="inline-flex items-center gap-2 text-sm border rounded-md px-3 h-9 hover:bg-slate-50">
          <Pencil className="h-4 w-4" /> Edit
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
        <Card><CardContent className="pt-6"><p className="text-slate-500">Vehicles</p><p className="text-xl font-bold">{v.vehicles.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-slate-500">Trips</p><p className="text-xl font-bold">{v.counts.trips}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-slate-500">Payments</p><p className="text-xl font-bold">{v.counts.payments}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Contact & Compliance</CardTitle></CardHeader>
          <CardContent>
            <Row label="Contact Person" value={v.contactName} />
            <Row label="Phone" value={v.phone} />
            <Row label="Alternate Phone" value={v.altPhone} />
            <Row label="Email" value={v.email} />
            <Row label="WhatsApp" value={v.whatsapp} />
            <Row label="GSTIN" value={v.gstin} />
            <Row label="PAN" value={v.pan} />
            <Row label="MSME / Udyam" value={v.msme} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Bank & Settlement</CardTitle></CardHeader>
          <CardContent>
            <Row label="Bank" value={v.bankName} />
            <Row label="Account" value={v.bankAccount} />
            <Row label="IFSC" value={v.bankIfsc} />
            <Row label="Branch" value={v.bankBranch} />
            <Row label="Account Holder" value={v.accountHolder} />
            <Row label="UPI ID" value={v.upiId} />
            <Row label="Payment Terms" value={v.paymentTerms ? `${v.paymentTerms} days` : ""} />
            <Row label="TDS Applicable" value={v.tdsApplicable ? "Yes" : "No"} />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Address</CardTitle></CardHeader>
        <CardContent>
          <Row label="Address" value={[v.addressLine1, v.addressLine2].filter(Boolean).join(", ")} />
          <Row label="City / State" value={[v.city, v.state].filter(Boolean).join(", ")} />
          <Row label="Pincode" value={v.pincode} />
          <Row label="Notes" value={v.notes} />
        </CardContent>
      </Card>

      {v.vehicles.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Vehicles ({v.vehicles.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {v.vehicles.map((veh) => (
                <div key={veh.id} className="flex items-center justify-between border-b pb-2 last:border-0 text-sm">
                  <Link href={`/vehicles/${veh.id}`} className="text-blue-600 hover:underline font-medium">{veh.number}</Link>
                  <span className="text-slate-500">{veh.type.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent>
          <OnboardingDocuments
            ownerType="vendor"
            ownerId={v.id}
            documents={v.documents}
            allowedTypes={["GST", "PAN", "MSME", "BANK_PROOF", "AGREEMENT", "OTHER"]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
