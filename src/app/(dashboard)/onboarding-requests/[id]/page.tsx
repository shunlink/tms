import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import OpsClientOnboardingCompletion from "@/components/onboarding/ops-client-onboarding-completion";
import PageHeader from "@/components/page-header";
import { getSessionUser } from "@/lib/auth";
import {
  canAccessClientOnboardingRequest,
  canCompleteClientOnboardingRequest,
  isOnboardingRequestsSuperAdmin,
} from "@/lib/onboarding-request-access";
import { getClientDetail } from "@/lib/queries";
import { hasPermission } from "@/lib/services/permission.service";
import { getOnboardingCase } from "@/lib/services/onboarding.service";

export const dynamic = "force-dynamic";

export default async function OnboardingRequestDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");
  const allowed =
    user.role === "SUPER_ADMIN" || (await hasPermission(user.id, "onboarding.ops"));
  if (!allowed) redirect("/");

  const case_ = await getOnboardingCase("CLIENT", params.id);
  const isSuperAdmin = isOnboardingRequestsSuperAdmin(user.role);
  if (!canAccessClientOnboardingRequest(user.id, isSuperAdmin, case_)) notFound();
  const canComplete = canCompleteClientOnboardingRequest(user.id, isSuperAdmin, case_);

  const c = await getClientDetail(params.id);
  if (!c) notFound();

  const initial = {
    name: c.name ?? "",
    businessType: c.businessType ?? "",
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
    bankName: c.bankName ?? "",
    bankAccount: c.bankAccount ?? "",
    bankIfsc: c.bankIfsc ?? "",
    bankBranch: c.bankBranch ?? "",
    accountHolder: c.accountHolder ?? "",
    notes: c.notes ?? "",
  };

  return (
    <div>
      <Link
        href="/onboarding-requests"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </Link>
      <PageHeader
        title={c.name ?? "Client onboarding"}
        description="Complete missing profile fields, upload documents (including agreement if needed), and submit for admin approval."
      />
      <OpsClientOnboardingCompletion
        clientId={c.id}
        canComplete={canComplete}
        initial={initial}
        documents={c.documents}
        gstVerificationMeta={{
          verificationStatus: c.gstVerificationStatus,
          verifiedAt: c.gstVerifiedAt?.toISOString() ?? null,
          provider: c.gstVerificationProvider,
        }}
        submittedSnapshot={{
          pan: c.pan,
          gstin: c.gstin,
          businessType: c.businessType,
          bankName: c.bankName,
          bankAccount: c.bankAccount,
          bankIfsc: c.bankIfsc,
          accountHolder: c.accountHolder,
        }}
      />
    </div>
  );
}
