import { Building2, CreditCard, FileCheck2, MapPin, Phone, StickyNote } from "lucide-react";
import PortalSectionCard from "@/components/portal/portal-section-card";
import {
  GstVerificationBadge,
  ProfileField,
  ProfileFieldGrid,
  formatProfileValue,
} from "@/components/portal/portal-profile-field";
import { formatDeliveryZones } from "@/lib/delivery-zones";

const VENDOR_TYPE_LABEL: Record<string, string> = {
  FLEET_OWNER: "Fleet owner",
  BROKER: "Broker",
};

type VendorProfileData = {
  name: string | null;
  type: string | null;
  contactName: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  whatsapp: string | null;
  gstin: string | null;
  pan: string | null;
  msme: string | null;
  gstVerificationStatus?: string | null;
  gstVerifiedAt?: Date | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  accountHolder: string | null;
  upiId: string | null;
  paymentTerms: number | null;
  tdsApplicable?: boolean;
  notes: string | null;
  deliveryZones?: string[];
};

export default function PortalVendorProfileView({ vendor }: { vendor: VendorProfileData }) {
  const typeLabel = vendor.type ? (VENDOR_TYPE_LABEL[vendor.type] ?? vendor.type) : null;

  return (
    <div className="space-y-6">
      <PortalSectionCard title="Vendor" description="Business identity and primary contacts">
        <div className="flex flex-wrap items-center gap-3 mb-5 -mt-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold text-foreground truncate">
              {formatProfileValue(vendor.name)}
            </p>
            {typeLabel && <p className="text-sm text-muted-foreground">{typeLabel}</p>}
          </div>
        </div>
        <ProfileFieldGrid>
          <ProfileField label="Vendor type" value={typeLabel} />
          <ProfileField label="Contact person" value={vendor.contactName} />
          <ProfileField label="Phone" value={vendor.phone} />
          <ProfileField label="Alternate phone" value={vendor.altPhone} />
          <ProfileField label="Email" value={vendor.email} />
          <ProfileField label="WhatsApp" value={vendor.whatsapp} />
        </ProfileFieldGrid>
      </PortalSectionCard>

      <PortalSectionCard title="Compliance" description="Tax and registration details">
        <div className="mb-4">
          <GstVerificationBadge status={vendor.gstVerificationStatus} verifiedAt={vendor.gstVerifiedAt} />
        </div>
        <ProfileFieldGrid columns={3}>
          <ProfileField label="GSTIN" value={vendor.gstin} mono />
          <ProfileField label="PAN" value={vendor.pan} mono />
          <ProfileField label="MSME / Udyam" value={vendor.msme} mono />
        </ProfileFieldGrid>
      </PortalSectionCard>

      <PortalSectionCard title="Address" description="Registered business address">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4">
          <MapPin className="h-4 w-4" aria-hidden />
        </div>
        <ProfileFieldGrid>
          <ProfileField label="Address line 1" value={vendor.addressLine1} />
          <ProfileField label="Address line 2" value={vendor.addressLine2} />
          <ProfileField label="City" value={vendor.city} />
          <ProfileField label="State" value={vendor.state} />
          <ProfileField label="Pincode" value={vendor.pincode} />
          <ProfileField
            label="Delivery zones"
            value={formatDeliveryZones(vendor.deliveryZones ?? [])}
          />
        </ProfileFieldGrid>
      </PortalSectionCard>

      <PortalSectionCard title="Bank & settlement" description="Payout account and terms">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4">
          <CreditCard className="h-4 w-4" aria-hidden />
        </div>
        <ProfileFieldGrid>
          <ProfileField label="Bank name" value={vendor.bankName} />
          <ProfileField label="Account holder" value={vendor.accountHolder} />
          <ProfileField label="Account number" value={vendor.bankAccount} mono />
          <ProfileField label="IFSC" value={vendor.bankIfsc} mono />
          <ProfileField label="Branch" value={vendor.bankBranch} />
          <ProfileField label="UPI ID" value={vendor.upiId} mono />
          <ProfileField
            label="Payment terms"
            value={vendor.paymentTerms != null ? `${vendor.paymentTerms} days` : null}
          />
          <ProfileField label="TDS applicable" value={vendor.tdsApplicable ? "Yes" : "No"} />
        </ProfileFieldGrid>
      </PortalSectionCard>

      {vendor.notes && (
        <PortalSectionCard title="Notes">
          <div className="flex gap-3">
            <StickyNote className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{vendor.notes}</p>
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
