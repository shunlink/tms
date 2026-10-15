import { redirect } from "next/navigation";
import {
  Building2,
  FileCheck2,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  StickyNote,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Globe,
  ExternalLink,
} from "lucide-react";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import { getSessionUser } from "@/lib/auth";
import { CLIENT_ONBOARDING_DOCS } from "@/lib/onboarding-docs";
import { getClientDetail } from "@/lib/queries";
import { formatInr, formatProfileValue, GstVerificationBadge } from "@/components/portal/portal-profile-field";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login?portal=client");

  const c = await getClientDetail(user.clientId);
  if (!c) redirect("/portal/client");

  const showCommercials = c.onboardingStatus === "APPROVED";

  return (
    <div className="space-y-6">
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight leading-tight">
            Profile & Documents
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Your registered company details, compliance identifiers, and verified onboarding documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          {c.onboardingStatus === "APPROVED" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Verified Account</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Status: {c.onboardingStatus}</span>
            </span>
          )}
        </div>
      </div>

      {/* =========================================================================
          COMPANY IDENTITY HERO CARD
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-[#D97706] flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-950">
                {formatProfileValue(c.name)}
              </h2>
              {c.legalName && c.legalName !== c.name && (
                <p className="text-xs text-gray-500 mt-0.5">{c.legalName}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Legal Business Name
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {formatProfileValue(c.legalName)}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Industry / Sector
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {formatProfileValue(c.industry)}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Official Website
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {c.website ? (
                <a
                  href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                >
                  <span>{c.website}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          COMPLIANCE & TAX IDENTIFICATION
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-950">Compliance & Tax Identification</h3>
            <p className="text-xs text-gray-500">
              Government registration codes and tax identification details
            </p>
          </div>
          <div>
            <GstVerificationBadge status={c.gstVerificationStatus} verifiedAt={c.gstVerifiedAt} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/60">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">GSTIN</p>
            <p className="text-xs sm:text-sm font-mono font-bold text-gray-900 mt-1">
              {formatProfileValue(c.gstin)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/60">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">PAN</p>
            <p className="text-xs sm:text-sm font-mono font-bold text-gray-900 mt-1">
              {formatProfileValue(c.pan)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/60">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">CIN</p>
            <p className="text-xs sm:text-sm font-mono font-bold text-gray-900 mt-1">
              {formatProfileValue(c.cin)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/60">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">MSME / Udyam</p>
            <p className="text-xs sm:text-sm font-mono font-bold text-gray-900 mt-1">
              {formatProfileValue(c.msme)}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PRIMARY CONTACTS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-950">Primary Contacts</h3>
          <p className="text-xs text-gray-500">
            Designated coordinators for operational dispatch and billing communication
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-1">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Contact Person
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {formatProfileValue(c.contactName)}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Primary Phone
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {formatProfileValue(c.phone)}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Alternate Phone
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {formatProfileValue(c.altPhone)}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Operations Email
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {formatProfileValue(c.email)}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Accounts & Invoicing Email
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {formatProfileValue(c.accountsEmail)}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ADDRESSES (Billing & Shipping)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Billing Address */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-950">Billing Address</h3>
              <p className="text-[11px] text-gray-500">Registered tax invoice address</p>
            </div>
          </div>

          <div className="text-xs leading-relaxed text-gray-700 bg-gray-50/70 rounded-xl p-4 border border-gray-200/60">
            <p className="font-semibold text-gray-900 mb-1">
              {formatProfileValue(c.billingAddress || c.addressLine1)}
            </p>
            {c.addressLine2 && <p className="text-gray-600">{c.addressLine2}</p>}
            <p className="text-gray-600 mt-1">
              {[c.city, c.state, c.pincode].filter(Boolean).join(", ")}
            </p>
            <p className="text-gray-500 font-medium">{c.country ?? "India"}</p>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-950">Shipping / Consignee Address</h3>
              <p className="text-[11px] text-gray-500">Default dispatch destination</p>
            </div>
          </div>

          <div className="text-xs leading-relaxed text-gray-700 bg-gray-50/70 rounded-xl p-4 border border-gray-200/60">
            <p className="font-semibold text-gray-900 mb-1">
              {formatProfileValue(c.shippingAddress || c.billingAddress || c.addressLine1)}
            </p>
            <p className="text-gray-600 mt-1">
              {[c.shippingCity || c.city, c.shippingState || c.state, c.shippingPincode || c.pincode]
                .filter(Boolean)
                .join(", ")}
            </p>
            <p className="text-gray-500 font-medium">India</p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          COMMERCIAL TERMS & BANK DETAILS (When Approved)
          ========================================================================= */}
      {showCommercials && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Commercial Terms */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <FileCheck2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-950">Commercial Terms</h3>
                <p className="text-[11px] text-gray-500">Agreed credit limits and payment windows</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/60">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Credit Limit
                </p>
                <p className="text-xs sm:text-sm font-mono font-bold text-gray-950 mt-1">
                  {formatInr(c.creditLimit)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/60">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Payment Terms
                </p>
                <p className="text-xs sm:text-sm font-bold text-gray-950 mt-1">
                  {c.paymentTerms != null ? `${c.paymentTerms} Days` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-950">Bank Account Details</h3>
                <p className="text-[11px] text-gray-500">Account on file for credit checks and refunds</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Bank Name</span>
                <span className="font-semibold text-gray-900">{formatProfileValue(c.bankName)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Account Holder</span>
                <span className="font-semibold text-gray-900">{formatProfileValue(c.accountHolder)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Account Number</span>
                <span className="font-mono font-semibold text-gray-900">{formatProfileValue(c.bankAccount)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">IFSC Code</span>
                <span className="font-mono font-semibold text-gray-900">{formatProfileValue(c.bankIfsc)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DOCUMENTS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-950">Onboarding Documents</h3>
            <p className="text-xs text-gray-500">
              Certificates, agreements, and identity documents submitted during verification
            </p>
          </div>
        </div>

        <OnboardingDocuments
          documents={c.documents}
          docTypes={CLIENT_ONBOARDING_DOCS}
          readOnly
          allowDelete={false}
        />
      </div>

      {/* Notes if any */}
      {c.notes && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
          <div className="flex gap-3">
            <StickyNote className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-gray-900 mb-1">Account Notes</p>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{c.notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Notice */}
      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100/80 flex items-center gap-3 text-xs text-blue-900">
        <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
        <p>
          Company details and compliance documents are managed securely. If you need to update any information, please reach out to our team at{" "}
          <a href="mailto:founder@shunlink.in" className="font-bold underline hover:text-blue-950">
            founder@shunlink.in
          </a>
          .
        </p>
      </div>
    </div>
  );
}
