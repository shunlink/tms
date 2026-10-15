import { notFound } from "next/navigation";
import VendorForm from "@/components/forms/vendor-form";
import { getVendorDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditVendorPage({ params }: { params: { id: string } }) {
  const v = await getVendorDetail(params.id);
  if (!v) notFound();

  const initial = {
    name: v.name ?? "",
    type: v.type ?? "FLEET_OWNER",
    contactName: v.contactName ?? "",
    phone: v.phone ?? "",
    altPhone: v.altPhone ?? "",
    email: v.email ?? "",
    whatsapp: v.whatsapp ?? "",
    gstin: v.gstin ?? "",
    pan: v.pan ?? "",
    msme: v.msme ?? "",
    addressLine1: v.addressLine1 ?? "",
    addressLine2: v.addressLine2 ?? "",
    city: v.city ?? "",
    state: v.state ?? "",
    pincode: v.pincode ?? "",
    bankName: v.bankName ?? "",
    bankAccount: v.bankAccount ?? "",
    bankIfsc: v.bankIfsc ?? "",
    bankBranch: v.bankBranch ?? "",
    accountHolder: v.accountHolder ?? "",
    upiId: v.upiId ?? "",
    paymentTerms: v.paymentTerms != null ? String(v.paymentTerms) : "",
    notes: v.notes ?? "",
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Edit Vendor</h1>
        <p className="text-slate-500">{v.name}</p>
      </div>
      <VendorForm
        initial={initial}
        vendorId={v.id}
        gstVerificationMeta={{
          verificationStatus: v.gstVerificationStatus,
          verifiedAt: v.gstVerifiedAt?.toISOString() ?? null,
          provider: v.gstVerificationProvider,
        }}
      />
    </div>
  );
}
