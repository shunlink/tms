import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import PortalPageHeader from "@/components/portal/portal-page-header";
import PortalSectionCard from "@/components/portal/portal-section-card";
import PortalEmptyState from "@/components/portal/portal-empty-state";
import {
  PortalTable,
  PortalTableWrap,
  portalTbodyRow,
  portalTd,
  portalTdMuted,
  portalTdStrong,
  portalTh,
  portalTheadRow,
} from "@/components/portal/portal-data-table";
import StatusBadge from "@/components/status-badge";
import { getSessionUser } from "@/lib/auth";
import { getVendorPayments } from "@/lib/queries";
import { formatINR, formatDate, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorPaymentsPage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login");

  const payments = await getVendorPayments(user.vendorId);
  const paidTotal = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.paidAmount, 0);
  const advanceTotal = payments
    .filter((p) => p.paymentType === "ADVANCE" && p.status === "PAID")
    .reduce((s, p) => s + p.paidAmount, 0);
  const balanceTotal = payments
    .filter((p) => p.paymentType === "BALANCE" && p.status === "PAID")
    .reduce((s, p) => s + p.paidAmount, 0);

  return (
    <div>
      <PortalPageHeader
        accent="vendor"
        title="Payments"
        description={`Total received ${formatINR(paidTotal)} · Advances ${formatINR(advanceTotal)} · Balance ${formatINR(balanceTotal)}`}
      />

      <PortalSectionCard title={`Payment history (${payments.length})`}>
        {payments.length === 0 ? (
          <PortalEmptyState
            icon={Wallet}
            title="No payments recorded yet"
            description="Advance and balance payouts appear here once finance processes them."
          />
        ) : (
          <PortalTableWrap>
            <PortalTable>
              <thead>
                <tr className={portalTheadRow}>
                  <th className={portalTh}>Date</th>
                  <th className={portalTh}>Type</th>
                  <th className={portalTh}>LR No.</th>
                  <th className={portalTh}>Route</th>
                  <th className={cn(portalTh, "text-right")}>Freight</th>
                  <th className={cn(portalTh, "text-right")}>Paid</th>
                  <th className={portalTh}>Reference</th>
                  <th className={portalTh}>Status</th>
                  <th className={portalTh}>Proof</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={portalTbodyRow}>
                    <td className={portalTdMuted}>{p.paidAt ? formatDate(p.paidAt) : "—"}</td>
                    <td className={portalTdMuted}>{p.paymentTypeLabel}</td>
                    <td className={portalTdStrong}>
                      <Link href={`/portal/vendor/trips/${p.tripId}`} className="text-primary hover:underline">
                        {p.lrNumber}
                      </Link>
                    </td>
                    <td className={portalTdMuted}>{p.route}</td>
                    <td className={`${portalTdStrong} text-right tabular-nums`}>{formatINR(p.amount)}</td>
                    <td className={`${portalTdStrong} text-right tabular-nums text-success`}>
                      {formatINR(p.paidAmount)}
                    </td>
                    <td className={portalTdMuted}>{p.referenceNo ?? p.chequeNumber ?? "—"}</td>
                    <td className={portalTd}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className={portalTd}>
                      <div className="flex flex-wrap gap-2">
                        {p.proofUrl && (
                          <a
                            href={p.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary text-sm hover:underline font-medium"
                          >
                            Proof
                          </a>
                        )}
                        {p.voucherUrl && (
                          <a
                            href={p.voucherUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary text-sm hover:underline font-medium"
                          >
                            Voucher
                          </a>
                        )}
                        {!p.proofUrl && !p.voucherUrl && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </PortalTable>
          </PortalTableWrap>
        )}
      </PortalSectionCard>
    </div>
  );
}
