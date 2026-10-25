"use client";

import { useState } from "react";
import DataTable, { type DataColumn } from "@/components/data-table";
import AdvanceRequestDetailDialog from "@/components/forms/advance-request-detail-dialog";
import { formatINR, formatDate } from "@/lib/utils";

type AdvanceRequestRow = {
  id: string;
  vendorId: string;
  requestNumber: string;
  bulkRequestGroupId?: string | null;
  status: string;
  requestedAmount: number;
  negotiatedAmount: number | null;
  approvedAmount: number | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  paymentDate: string | Date | null;
  utrReference: string | null;
  bankAccountUsed: string | null;
  voucherNumber: string | null;
  requestedAt: string | Date;
  deadlineAt: string | Date;
  slaBreached: boolean;
  slaRemainingMs: number;
  source?: string;
  sourceLabel?: string;
  raisedByLabel?: string;
  vendor: { name: string };
  trip: {
    id: string;
    lrNumber: string;
    route: string;
    client: string;
    indentId: string | null;
    indentNumber: string | null;
  } | null;
  paymentProof: { url: string; fileName: string | null } | null;
  voucher: { url: string; fileName: string | null } | null;
  events: Array<{
    action: string;
    amount: number | null;
    remarks: string | null;
    createdAt: string | Date;
    actor: { name: string | null } | null;
  }>;
};

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  PENDING_REVIEW: "warning",
  NEGOTIATED: "info",
  VENDOR_ACCEPTED: "info",
  APPROVED: "success",
  PROCESSING: "warning",
  PROCESSED: "success",
  SLA_BREACHED: "danger",
  REJECTED: "danger",
  CANCELLED: "muted",
};

function formatSlaCell(row: AdvanceRequestRow) {
  if (row.status === "PROCESSED" || row.status === "REJECTED") return "—";
  if (row.slaBreached) return "SLA Breached";
  const hours = Math.floor(row.slaRemainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((row.slaRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
  return `Due in ${hours}h ${minutes}m`;
}

export default function AdvancePaymentsTable({
  requests,
  canDecide,
  canProcess,
  canMarkPaid,
  currentUserId,
}: {
  requests: AdvanceRequestRow[];
  canDecide: boolean;
  canProcess: boolean;
  canMarkPaid: boolean;
  currentUserId?: string | null;
}) {
  const [selected, setSelected] = useState<AdvanceRequestRow | null>(null);

  const rows = requests.map((r) => ({
    ...r,
    vendorName: r.vendor.name,
    sourceDisplay: r.sourceLabel ?? (r.source === "INTERNAL" ? "Internal" : "Vendor"),
    raisedByDisplay: r.raisedByLabel ?? "—",
    bulkLabel: r.bulkRequestGroupId
      ? `Bulk · …${r.bulkRequestGroupId.slice(-6)}`
      : "—",
    tripLr: r.trip?.lrNumber ?? "—",
    requestedAmountDisplay: formatINR(r.requestedAmount),
    negotiatedAmountDisplay: r.negotiatedAmount != null ? formatINR(r.negotiatedAmount) : "—",
    requestedAtDisplay: formatDate(r.requestedAt),
    slaDisplay: formatSlaCell(r),
  }));

  const columns: DataColumn[] = [
    { key: "requestNumber", header: "Request ID" },
    { key: "bulkLabel", header: "Batch" },
    { key: "tripLr", header: "Trip (LR)" },
    { key: "vendorName", header: "Vendor" },
    { key: "sourceDisplay", header: "Source" },
    { key: "raisedByDisplay", header: "Raised By" },
    { key: "requestedAmountDisplay", header: "Requested", align: "right" },
    { key: "negotiatedAmountDisplay", header: "Negotiated", align: "right" },
    { key: "status", header: "Status", kind: "badge", tones: statusTones },
    { key: "requestedAtDisplay", header: "Requested At" },
    { key: "slaDisplay", header: "SLA" },
  ];

  return (
    <>
      <DataTable
        rows={rows as unknown as Record<string, unknown>[]}
        columns={columns}
        searchKeys={["requestNumber", "vendorName", "tripLr", "status"]}
        exportName="advance-payments"
        emptyText="No ShunLink advance requests yet."
        onRowClick={(row) => {
          const match = requests.find((r) => r.id === row.id);
          if (match) setSelected(match);
        }}
      />
      {selected && (
        <AdvanceRequestDetailDialog
          request={selected}
          canDecide={canDecide}
          canProcess={canProcess}
          canMarkPaid={canMarkPaid}
          currentUserId={currentUserId}
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
