"use client";

import { ExternalLink, FileText } from "lucide-react";
import StatusBadge from "@/components/status-badge";
import { formatDate, formatINR } from "@/lib/utils";

type Doc = { id: string; type: string; url: string; name: string | null; createdAt?: string };

const DOC_LABELS: Record<string, string> = {
  GST: "GST Certificate",
  PAN: "PAN Card",
  AADHAAR: "Aadhaar",
  MSME: "MSME / Udyam",
  BANK_PROOF: "Bank Proof",
  CIN: "CIN Certificate",
  AGREEMENT: "Agreement",
  LICENSE: "Driving License",
  RC: "RC Certificate",
  INSURANCE: "Insurance",
  FITNESS: "Fitness Certificate",
  PUC: "PUC Certificate",
  PERMIT: "Permit",
  OTHER: "Other",
};

function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-slate-100 last:border-0">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-slate-900 text-right break-words">{value || "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <h4 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/80">
        {title}
      </h4>
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}

type ClientEntity = {
  name: string;
  legalName?: string | null;
  industry?: string | null;
  website?: string | null;
  contactName?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  accountsEmail?: string | null;
  gstin?: string | null;
  pan?: string | null;
  cin?: string | null;
  msme?: string | null;
  billingAddress?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPincode?: string | null;
  paymentTerms?: number | null;
  creditLimit?: number | null;
  securityDeposit?: number | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  accountHolder?: string | null;
  notes?: string | null;
  documents?: Doc[];
};

type VendorEntity = {
  name: string;
  type?: string | null;
  contactName?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  gstin?: string | null;
  pan?: string | null;
  msme?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  accountHolder?: string | null;
  upiId?: string | null;
  paymentTerms?: number | null;
  tdsApplicable?: boolean;
  rating?: number | null;
  notes?: string | null;
  documents?: Doc[];
};

type VehicleEntity = {
  number: string;
  type?: string | null;
  bodyType?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  capacity?: string | null;
  ownership?: string | null;
  vendor?: { id: string; name: string } | null;
  rcNumber?: string | null;
  rcExpiry?: Date | string | null;
  ownerName?: string | null;
  ownerPan?: string | null;
  insuranceNumber?: string | null;
  insuranceCompany?: string | null;
  insuranceExpiry?: Date | string | null;
  insuranceValue?: number | null;
  fitnessExpiry?: Date | string | null;
  pucNumber?: string | null;
  pucExpiry?: Date | string | null;
  permitType?: string | null;
  permitNumber?: string | null;
  permitExpiry?: Date | string | null;
  gpsEnabled?: boolean;
  gpsDeviceId?: string | null;
  fastagId?: string | null;
  remarks?: string | null;
  documents?: Doc[];
};

export type OnboardingApplicationSnapshot = {
  type: string;
  entity: ClientEntity | VendorEntity | VehicleEntity;
  submission: {
    status: string;
    remarks: string | null;
    submittedAt: Date | string | null;
    reviewedAt: Date | string | null;
    reviewedBy: string | null;
    createdAt: Date | string | null;
  };
};

function DocumentsList({ docs, type }: { docs: Doc[]; type: string }) {
  if (docs.length === 0) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        No documents uploaded by the {type}.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li
          key={d.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-700">{DOC_LABELS[d.type] ?? d.type}</p>
            <p className="truncate text-xs text-slate-500">{d.name ?? "File"}</p>
          </div>
          <a
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            <ExternalLink className="h-3 w-3" /> View
          </a>
        </li>
      ))}
    </ul>
  );
}

function ClientSnapshot({ entity }: { entity: ClientEntity }) {
  return (
    <div className="space-y-3">
      <Section title="Application / Company Information">
        <Row label="Company Name" value={entity.name} />
        <Row label="Legal Name" value={entity.legalName} />
        <Row label="Industry" value={entity.industry} />
        <Row label="Website" value={entity.website} />
      </Section>

      <Section title="Contact Information">
        <Row label="Contact Person" value={entity.contactName} />
        <Row label="Phone" value={entity.phone} />
        <Row label="Alternate Phone" value={entity.altPhone} />
        <Row label="Email" value={entity.email} />
        <Row label="Accounts Email" value={entity.accountsEmail} />
      </Section>

      <Section title="Address & Location">
        <Row label="Billing Address" value={entity.billingAddress} />
        <Row label="Address Line 1" value={entity.addressLine1} />
        <Row label="Address Line 2" value={entity.addressLine2} />
        <Row label="City" value={entity.city} />
        <Row label="State" value={entity.state} />
        <Row label="Pincode" value={entity.pincode} />
        <Row label="Country" value={entity.country} />
        <Row label="Shipping Address" value={entity.shippingAddress} />
        <Row label="Shipping City" value={entity.shippingCity} />
        <Row label="Shipping State" value={entity.shippingState} />
        <Row label="Shipping Pincode" value={entity.shippingPincode} />
      </Section>

      <Section title="Business Information">
        <Row label="GSTIN" value={entity.gstin} />
        <Row label="PAN" value={entity.pan} />
        <Row label="CIN" value={entity.cin} />
        <Row label="MSME / Udyam" value={entity.msme} />
        <Row label="Payment Terms" value={entity.paymentTerms ? `${entity.paymentTerms} days` : null} />
        <Row label="Credit Limit" value={entity.creditLimit ? formatINR(entity.creditLimit) : null} />
        <Row
          label="Security Deposit"
          value={entity.securityDeposit ? formatINR(entity.securityDeposit) : null}
        />
      </Section>

      <Section title="Client Information">
        <Row label="Bank" value={entity.bankName} />
        <Row label="Account Number" value={entity.bankAccount} />
        <Row label="IFSC" value={entity.bankIfsc} />
        <Row label="Branch" value={entity.bankBranch} />
        <Row label="Account Holder" value={entity.accountHolder} />
        {entity.notes && <Row label="Notes" value={entity.notes} />}
      </Section>
    </div>
  );
}

function VendorSnapshot({ entity }: { entity: VendorEntity }) {
  return (
    <div className="space-y-3">
      <Section title="Application / Company Information">
        <Row label="Business Name" value={entity.name} />
        <Row
          label="Vendor Type"
          value={entity.type === "FLEET_OWNER" ? "Fleet Owner" : entity.type === "BROKER" ? "Broker" : entity.type}
        />
        {entity.rating != null && <Row label="Rating" value={`★ ${entity.rating.toFixed(1)}`} />}
      </Section>

      <Section title="Contact Information">
        <Row label="Contact Person" value={entity.contactName} />
        <Row label="Phone" value={entity.phone} />
        <Row label="Alternate Phone" value={entity.altPhone} />
        <Row label="Email" value={entity.email} />
        <Row label="WhatsApp" value={entity.whatsapp} />
      </Section>

      <Section title="Address & Location">
        <Row
          label="Address"
          value={[entity.addressLine1, entity.addressLine2].filter(Boolean).join(", ")}
        />
        <Row label="City" value={entity.city} />
        <Row label="State" value={entity.state} />
        <Row label="Pincode" value={entity.pincode} />
      </Section>

      <Section title="Business Information">
        <Row label="GSTIN" value={entity.gstin} />
        <Row label="PAN" value={entity.pan} />
        <Row label="MSME / Udyam" value={entity.msme} />
        <Row label="Payment Terms" value={entity.paymentTerms ? `${entity.paymentTerms} days` : null} />
        <Row label="TDS Applicable" value={entity.tdsApplicable ? "Yes" : "No"} />
      </Section>

      <Section title="Vendor Information">
        <Row label="Bank" value={entity.bankName} />
        <Row label="Account Number" value={entity.bankAccount} />
        <Row label="IFSC" value={entity.bankIfsc} />
        <Row label="Branch" value={entity.bankBranch} />
        <Row label="Account Holder" value={entity.accountHolder} />
        <Row label="UPI ID" value={entity.upiId} />
        {entity.notes && <Row label="Notes" value={entity.notes} />}
      </Section>
    </div>
  );
}

function VehicleSnapshot({ entity }: { entity: VehicleEntity }) {
  return (
    <div className="space-y-3">
      <Section title="Vehicle Information">
        <Row label="Registration Number" value={entity.number} />
        <Row label="Type" value={entity.type?.replace(/_/g, " ")} />
        <Row label="Body Type" value={entity.bodyType} />
        <Row label="Make / Model" value={[entity.make, entity.model].filter(Boolean).join(" ")} />
        <Row label="Year" value={entity.year} />
        <Row label="Capacity" value={entity.capacity} />
        <Row label="Ownership" value={entity.ownership} />
        <Row label="Vendor" value={entity.vendor?.name} />
      </Section>

      <Section title="Registration & Compliance">
        <Row label="RC Number" value={entity.rcNumber} />
        <Row label="RC Expiry" value={formatDate(entity.rcExpiry)} />
        <Row label="Owner Name" value={entity.ownerName} />
        <Row label="Owner PAN" value={entity.ownerPan} />
        <Row label="Insurance Number" value={entity.insuranceNumber} />
        <Row label="Insurance Company" value={entity.insuranceCompany} />
        <Row label="Insurance Expiry" value={formatDate(entity.insuranceExpiry)} />
        <Row
          label="Insurance Value"
          value={entity.insuranceValue ? formatINR(entity.insuranceValue) : null}
        />
        <Row label="Fitness Expiry" value={formatDate(entity.fitnessExpiry)} />
        <Row label="PUC Number" value={entity.pucNumber} />
        <Row label="PUC Expiry" value={formatDate(entity.pucExpiry)} />
        <Row label="Permit Type" value={entity.permitType} />
        <Row label="Permit Number" value={entity.permitNumber} />
        <Row label="Permit Expiry" value={formatDate(entity.permitExpiry)} />
      </Section>

      <Section title="Telematics">
        <Row label="GPS Enabled" value={entity.gpsEnabled ? "Yes" : "No"} />
        <Row label="GPS Device ID" value={entity.gpsDeviceId} />
        <Row label="FASTag ID" value={entity.fastagId} />
        {entity.remarks && <Row label="Remarks" value={entity.remarks} />}
      </Section>
    </div>
  );
}

export default function OnboardingReviewSnapshot({
  snapshot,
}: {
  snapshot: OnboardingApplicationSnapshot;
}) {
  const { type, entity, submission } = snapshot;
  const docs = entity.documents ?? [];

  return (
    <div className="space-y-3">
      <Section title="Verification Status">
        <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
          <span className="text-slate-500">Status</span>
          <StatusBadge status={submission.status} />
        </div>
        {submission.remarks && <Row label="Remarks" value={submission.remarks} />}
      </Section>

      <Section title="Submission Information">
        <Row label="Submitted At" value={formatDateTime(submission.submittedAt)} />
        <Row label="Application Created" value={formatDateTime(submission.createdAt)} />
        <Row label="Reviewed At" value={formatDateTime(submission.reviewedAt)} />
        <Row label="Reviewed By" value={submission.reviewedBy} />
      </Section>

      {type === "client" && <ClientSnapshot entity={entity as ClientEntity} />}
      {type === "vendor" && <VendorSnapshot entity={entity as VendorEntity} />}
      {type === "vehicle" && <VehicleSnapshot entity={entity as VehicleEntity} />}

      <section className="rounded-lg border border-slate-200 bg-white">
        <h4 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/80 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Uploaded Documents
        </h4>
        <div className="px-3 py-3">
          <DocumentsList docs={docs} type={type} />
        </div>
      </section>
    </div>
  );
}
