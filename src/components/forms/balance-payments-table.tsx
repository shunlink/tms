"use client";

import { useState } from "react";
import DataTable, { type DataColumn } from "@/components/data-table";
import BalancePaymentDetailDialog from "@/components/forms/balance-payment-detail-dialog";
import { formatINR, formatDate } from "@/lib/utils";

type FinancialNoteSummary = {
  id: string;
  noteNumber: string | null;
  noteType: string;
  businessPurpose: string;
  purposeLabel: string;
  totalAmount: number;
  issuedAt: string | Date | null;
  reason: string | null;
};

type BalancePaymentRow = {
  id: string;
  vendorId: string;
  status: string;
  freightAmount: number;
  additionalChargesAmount: number;
  deductionsAmount: number;
  finalPayableAmount: number;
  advanceAmount: number;
  tdsAmount: number;
  balanceAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  podVerifiedAt: string | Date;
  deadlineAt: string | Date;
  slaBreached: boolean;
  slaRemainingMs: number;
  paymentMode: string | null;
  paymentDetails: string | null;
  vendor: { name: string };
  trip: {
    id: string;
    lrNumber: string;
    route: string;
    charges?: Array<{ id: string; chargeType: string; amount: number; description: string | null }>;
  } | null;
  indent: { indentNumber: string } | null;
  processedAt: string | Date | null;
  processedBy: { name: string | null } | null;
  approvedAt?: string | Date | null;
  approvedBy?: { name: string | null } | null;
  voucherNumber?: string | null;
  voucherFile?: { url: string; fileName: string | null } | null;
  payments?: Array<{
    id: string;
    amount: number;
    paidAt: string | Date;
    paymentMode: string | null;
    utrReference: string | null;
    chequeNumber: string | null;
    recordedBy: { name: string | null } | null;
    proof: { url: string; fileName: string | null } | null;
  }>;
  events: Array<{
    action: string;
    amount: number | null;
    remarks: string | null;
    createdAt: string | Date;
    actor: { name: string | null } | null;
  }>;
  financialNotes?: FinancialNoteSummary[];
};

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  PENDING_REVIEW: "warning",
  APPROVED: "info",
  PROCESSING: "info",
  PARTIALLY_PAID: "warning",
  PROCESSED: "success",
  SLA_BREACHED: "danger",
};

function formatSlaCell(row: BalancePaymentRow) {
  if (row.status === "PROCESSED") return "—";
  if (row.slaBreached) return "SLA Breached";
  const hours = Math.floor(row.slaRemainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((row.slaRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
  return `Due in ${hours}h ${minutes}m`;
}

export default function BalancePaymentsTable({
  tasks,
  canProcess,
  currentUserId,
}: {
  tasks: BalancePaymentRow[];
  canProcess: boolean;
  currentUserId?: string | null;
}) {
  const [selected, setSelected] = useState<BalancePaymentRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const rows = tasks.map((t) => ({
    ...t,
    vendorName: t.vendor.name,
    tripLr: t.trip?.lrNumber ?? "—",
    balanceDisplay: formatINR(t.outstandingBalance ?? t.balanceAmount),
    podVerifiedDisplay: formatDate(t.podVerifiedAt),
    slaDisplay: formatSlaCell(t),
  }));

  const columns: DataColumn[] = [
    { key: "tripLr", header: "Trip (LR)" },
    { key: "vendorName", header: "Vendor" },
    { key: "balanceDisplay", header: "Balance Due", align: "right" },
    { key: "status", header: "Status", kind: "badge", tones: statusTones },
    { key: "podVerifiedDisplay", header: "POD Verified" },
    { key: "slaDisplay", header: "SLA" },
  ];

  return (
    <>
      <DataTable
        rows={rows as unknown as Record<string, unknown>[]}
        columns={columns}
        searchKeys={["vendorName", "tripLr", "status"]}
        exportName="balance-payments"
        emptyText="No vendor balance payment tasks yet."
        onRowClick={async (row) => {
          setDetailError("");
          setLoadingDetail(true);
          try {
            const res = await fetch(`/api/balance-payments/${row.id}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setDetailError(data.error || "Could not load balance payment details");
              const match = tasks.find((t) => t.id === row.id);
              if (match) setSelected(match);
              return;
            }
            setSelected(data as BalancePaymentRow);
          } catch {
            setDetailError("Could not load balance payment details");
            const match = tasks.find((t) => t.id === row.id);
            if (match) setSelected(match);
          } finally {
            setLoadingDetail(false);
          }
        }}
      />
      {detailError && (
        <p className="text-sm text-amber-700 mb-2">{detailError} — showing cached row data.</p>
      )}
      {loadingDetail && (
        <p className="text-sm text-slate-500 mb-2">Refreshing payable totals and notes…</p>
      )}
      {selected && (
        <BalancePaymentDetailDialog
          task={{
            ...selected,
            payments: selected.payments ?? [],
            voucherNumber: selected.voucherNumber ?? null,
            voucherFile: selected.voucherFile ?? null,
            approvedAt: selected.approvedAt ?? null,
            approvedBy: selected.approvedBy ?? null,
          }}
          canProcess={canProcess}
          currentUserId={currentUserId}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
