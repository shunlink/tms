import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import { getClientDetail } from "@/lib/queries";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm border-b last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value || "—"}</span>
    </div>
  );
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const c = await getClientDetail(params.id);
  if (!c) notFound();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{c.name}</h1>
          <p className="text-slate-500">{c.legalName ?? c.industry ?? "Client"}</p>
        </div>
        <Link href={`/clients/${c.id}/edit`} className="inline-flex items-center gap-2 text-sm border rounded-md px-3 h-9 hover:bg-slate-50">
          <Pencil className="h-4 w-4" /> Edit
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
        <Card><CardContent className="pt-6"><p className="text-slate-500">Trips</p><p className="text-xl font-bold">{c.counts.trips}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-slate-500">Indents</p><p className="text-xl font-bold">{c.counts.indents}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-slate-500">Invoices</p><p className="text-xl font-bold">{c.counts.invoices}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-slate-500">Credit Limit</p><p className="text-xl font-bold">{c.creditLimit ? formatINR(c.creditLimit) : "—"}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Company</CardTitle></CardHeader>
          <CardContent>
            <Row label="Industry" value={c.industry} />
            <Row label="Website" value={c.website} />
            <Row label="GSTIN" value={c.gstin} />
            <Row label="PAN" value={c.pan} />
            <Row label="CIN" value={c.cin} />
            <Row label="MSME / Udyam" value={c.msme} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
          <CardContent>
            <Row label="Contact Person" value={c.contactName} />
            <Row label="Phone" value={c.phone} />
            <Row label="Alternate Phone" value={c.altPhone} />
            <Row label="Email" value={c.email} />
            <Row label="Accounts Email" value={c.accountsEmail} />
            <Row label="Payment Terms" value={c.paymentTerms ? `${c.paymentTerms} days` : ""} />
            <Row label="Security Deposit" value={c.securityDeposit ? formatINR(c.securityDeposit) : ""} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Billing Address</CardTitle></CardHeader>
          <CardContent>
            <Row label="Address" value={c.billingAddress} />
            <Row label="Line 1" value={c.addressLine1} />
            <Row label="Line 2" value={c.addressLine2} />
            <Row label="City / State" value={[c.city, c.state].filter(Boolean).join(", ")} />
            <Row label="Pincode" value={c.pincode} />
            <Row label="Country" value={c.country} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
          <CardContent>
            <Row label="Bank" value={c.bankName} />
            <Row label="Account" value={c.bankAccount} />
            <Row label="IFSC" value={c.bankIfsc} />
            <Row label="Branch" value={c.bankBranch} />
            <Row label="Account Holder" value={c.accountHolder} />
          </CardContent>
        </Card>
      </div>

      {c.notes && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-slate-700 whitespace-pre-wrap">{c.notes}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent>
          <OnboardingDocuments
            ownerType="client"
            ownerId={c.id}
            documents={c.documents}
            allowedTypes={["GST", "PAN", "CIN", "MSME", "BANK_PROOF", "AGREEMENT", "OTHER"]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
