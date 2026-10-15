import {
  Building2,
  CreditCard,
  FileCheck2,
  MapPin,
  Phone,
  StickyNote,
  Truck,
} from "lucide-react";
import PortalSectionCard from "@/components/portal/portal-section-card";
import {
  formatInr,
  formatProfileValue,
  GstVerificationBadge,
  ProfileField,
  ProfileFieldGrid,
} from "@/components/portal/portal-profile-field";

type ClientProfileData = {
  name: string | null;
  legalName: string | null;
  industry: string | null;
  website: string | null;
  gstin: string | null;
  pan: string | null;
  cin: string | null;
  msme: string | null;
  gstVerificationStatus?: string | null;
  gstVerifiedAt?: Date | null;
  contactName: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  accountsEmail: string | null;
  billingAddress: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  creditLimit: number | null;
  paymentTerms: number | null;
  securityDeposit: number | null;
  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  accountHolder: string | null;
  notes: string | null;
  onboardingStatus?: string;
};

export default function PortalClientProfileView({ client }: { client: ClientProfileData }) {
  const showCommercials = client.onboardingStatus === "APPROVED";

  return (
    <div className="space-y-6">
      <PortalSectionCard
        title="Company"
        description="Legal identity and business information on file"
        className="overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-3 mb-5 -mt-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold text-foreground truncate">
              {formatProfileValue(client.name)}
            </p>
            {client.legalName && client.legalName !== client.name && (
              <p className="text-sm text-muted-foreground truncate">{client.legalName}</p>
            )}
          </div>
        </div>
        <ProfileFieldGrid>
          <ProfileField label="Legal name" value={client.legalName} />
          <ProfileField label="Industry" value={client.industry} />
          <ProfileField label="Website" value={client.website} />
        </ProfileFieldGrid>
      </PortalSectionCard>

      <PortalSectionCard title="Compliance & tax" description="GST, PAN, and registration identifiers">
        <div className="mb-4">
          <GstVerificationBadge status={client.gstVerificationStatus} verifiedAt={client.gstVerifiedAt} />
        </div>
        <ProfileFieldGrid columns={3}>
          <ProfileField label="GSTIN" value={client.gstin} mono />
          <ProfileField label="PAN" value={client.pan} mono />
          <ProfileField label="CIN" value={client.cin} mono />
          <ProfileField label="MSME / Udyam" value={client.msme} mono />
        </ProfileFieldGrid>
      </PortalSectionCard>

      <PortalSectionCard title="Contacts" description="People we reach for operations and billing">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4">
          <Phone className="h-4 w-4" aria-hidden />
        </div>
        <ProfileFieldGrid>
          <ProfileField label="Contact person" value={client.contactName} />
          <ProfileField label="Phone" value={client.phone} />
          <ProfileField label="Alternate phone" value={client.altPhone} />
          <ProfileField label="Email" value={client.email} />
          <ProfileField label="Accounts email" value={client.accountsEmail} />
        </ProfileFieldGrid>
      </PortalSectionCard>

      <PortalSectionCard title="Billing address" description="Registered billing location">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4">
          <MapPin className="h-4 w-4" aria-hidden />
        </div>
        <ProfileFieldGrid>
          <ProfileField label="Full address" value={client.billingAddress} className="sm:col-span-2" />
          <ProfileField label="Address line 1" value={client.addressLine1} />
          <ProfileField label="Address line 2" value={client.addressLine2} />
          <ProfileField label="City" value={client.city} />
          <ProfileField label="State" value={client.state} />
          <ProfileField label="Pincode" value={client.pincode} />
          <ProfileField label="Country" value={client.country ?? "India"} />
        </ProfileFieldGrid>
      </PortalSectionCard>

      {showCommercials && (
        <>
          <PortalSectionCard title="Shipping address" description="Delivery / consignee address if different">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4">
              <Truck className="h-4 w-4" aria-hidden />
            </div>
            <ProfileFieldGrid>
              <ProfileField label="Full address" value={client.shippingAddress} className="sm:col-span-2" />
              <ProfileField label="City" value={client.shippingCity} />
              <ProfileField label="State" value={client.shippingState} />
              <ProfileField label="Pincode" value={client.shippingPincode} />
            </ProfileFieldGrid>
          </PortalSectionCard>

          <PortalSectionCard title="Commercial terms" description="Credit and payment terms agreed with ShunLink">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4">
              <FileCheck2 className="h-4 w-4" aria-hidden />
            </div>
            <ProfileFieldGrid columns={3}>
              <ProfileField label="Credit limit" value={formatInr(client.creditLimit)} />
              <ProfileField
                label="Payment terms"
                value={
                  client.paymentTerms != null ? `${client.paymentTerms} days` : null
                }
              />
              <ProfileField label="Security deposit" value={formatInr(client.securityDeposit)} />
            </ProfileFieldGrid>
          </PortalSectionCard>
        </>
      )}

      <PortalSectionCard title="Bank details" description="Account used for settlements">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4">
          <CreditCard className="h-4 w-4" aria-hidden />
        </div>
        <ProfileFieldGrid>
          <ProfileField label="Bank name" value={client.bankName} />
          <ProfileField label="Account holder" value={client.accountHolder} />
          <ProfileField label="Account number" value={client.bankAccount} mono />
          <ProfileField label="IFSC" value={client.bankIfsc} mono />
          <ProfileField label="Branch" value={client.bankBranch} />
        </ProfileFieldGrid>
      </PortalSectionCard>

      {client.notes && (
        <PortalSectionCard title="Notes">
          <div className="flex gap-3">
            <StickyNote className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{client.notes}</p>
          </div>
        </PortalSectionCard>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
        <FileCheck2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Profile changes are managed by your ShunLink administrator. Contact support if anything needs updating.
      </p>
    </div>
  );
}
