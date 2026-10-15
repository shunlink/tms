"use client";

import { useState } from "react";
import DataTable, { type DataColumn } from "@/components/data-table";
import ExternalAdvanceDetailDialog from "@/components/forms/external-advance-detail-dialog";
import { formatINR, formatDate } from "@/lib/utils";

type ExternalAdvanceRow = {
  id: string;
  requestNumber: string;
  status: string;
  externalProvider: string | null;
  requestedAmount: number;
  approvedAmount: number | null;
  requestedAt: string | Date;
  externalReference: string | null;
  processingRemarks: string | null;
  vendor: { name: string };
  trip: { id: string; lrNumber: string; route: string } | null;
};

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  EXTERNAL: "info",
};

export default function ExternalAdvancesTable({
  requests,
  canEdit,
}: {
  requests: ExternalAdvanceRow[];
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<ExternalAdvanceRow | null>(null);

  const rows = requests.map((r) => ({
    ...r,
    vendorName: r.vendor.name,
    tripLr: r.trip?.lrNumber ?? "—",
    provider: r.externalProvider ?? "—",
    requestedDisplay: r.requestedAmount > 0 ? formatINR(r.requestedAmount) : "—",
    approvedDisplay: r.approvedAmount != null ? formatINR(r.approvedAmount) : "—",
    requestedAtDisplay: formatDate(r.requestedAt),
    referenceDisplay: r.externalReference ?? "—",
  }));

  const columns: DataColumn[] = [
    { key: "requestNumber", header: "Request ID" },
    { key: "tripLr", header: "Trip (LR)" },
    { key: "vendorName", header: "Vendor" },
    { key: "provider", header: "Provider" },
    { key: "requestedDisplay", header: "Requested", align: "right" },
    { key: "approvedDisplay", header: "Approved/Raised", align: "right" },
    { key: "status", header: "Status", kind: "badge", tones: statusTones },
    { key: "requestedAtDisplay", header: "Request Date" },
    { key: "referenceDisplay", header: "Reference" },
  ];

  return (
    <>
      <DataTable
        rows={rows as unknown as Record<string, unknown>[]}
        columns={columns}
        searchKeys={["requestNumber", "vendorName", "tripLr", "provider"]}
        exportName="external-advances"
        emptyText="No external finance provider requests yet."
        onRowClick={(row) => {
          const match = requests.find((r) => r.id === row.id);
          if (match) setSelected(match);
        }}
      />
      {selected && (
        <ExternalAdvanceDetailDialog
          request={selected}
          canEdit={canEdit}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
