import { notFound } from "next/navigation";
import ClientForm from "@/components/forms/client-form";
import { getClientDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const c = await getClientDetail(params.id);
  if (!c) notFound();

  const initial = {
    name: c.name ?? "",
    legalName: c.legalName ?? "",
    industry: c.industry ?? "",
    website: c.website ?? "",
    gstin: c.gstin ?? "",
    pan: c.pan ?? "",
    cin: c.cin ?? "",
    msme: c.msme ?? "",
    contactName: c.contactName ?? "",
    phone: c.phone ?? "",
    altPhone: c.altPhone ?? "",
    email: c.email ?? "",
    accountsEmail: c.accountsEmail ?? "",
    billingAddress: c.billingAddress ?? "",
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    pincode: c.pincode ?? "",
    country: c.country ?? "India",
    shippingAddress: c.shippingAddress ?? "",
    shippingCity: c.shippingCity ?? "",
    shippingState: c.shippingState ?? "",
    shippingPincode: c.shippingPincode ?? "",
    creditLimit: c.creditLimit ? String(c.creditLimit) : "",
    paymentTerms: c.paymentTerms != null ? String(c.paymentTerms) : "",
    securityDeposit: c.securityDeposit ? String(c.securityDeposit) : "",
    bankName: c.bankName ?? "",
    bankAccount: c.bankAccount ?? "",
    bankIfsc: c.bankIfsc ?? "",
    bankBranch: c.bankBranch ?? "",
    accountHolder: c.accountHolder ?? "",
    notes: c.notes ?? "",
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Edit Client</h1>
        <p className="text-slate-500">{c.name}</p>
      </div>
      <ClientForm
        initial={initial}
        clientId={c.id}
        gstVerificationMeta={{
          verificationStatus: c.gstVerificationStatus,
          verifiedAt: c.gstVerifiedAt?.toISOString() ?? null,
          provider: c.gstVerificationProvider,
        }}
      />
    </div>
  );
}
