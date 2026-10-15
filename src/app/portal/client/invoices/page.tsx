import Link from "next/link";
import { FileText } from "lucide-react";
import StatusBadge from "@/components/status-badge";
import { redirect } from "next/navigation";
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
import { getSessionUser } from "@/lib/auth";
import { getClientInvoices } from "@/lib/queries";
import { formatINR, formatDate, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientInvoicesPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login");

  const invoices = await getClientInvoices(user.clientId);

  return (
    <div>
      <PortalPageHeader accent="client" title="Invoices" description="Your freight invoices and payment status" />

      <PortalSectionCard title={`All invoices (${invoices.length})`}>
        {invoices.length === 0 ? (
          <PortalEmptyState
            icon={FileText}
            title="No invoices yet"
            description="Invoices are generated after trips complete and POD is verified."
          />
        ) : (
          <PortalTableWrap>
            <PortalTable>
              <thead>
                <tr className={portalTheadRow}>
                  <th className={portalTh}>Invoice No.</th>
                  <th className={cn(portalTh, "text-right")}>Trips</th>
                  <th className={cn(portalTh, "text-right")}>Freight</th>
                  <th className={cn(portalTh, "text-right")}>GST</th>
                  <th className={cn(portalTh, "text-right")}>Total</th>
                  <th className={portalTh}>Due</th>
                  <th className={portalTh}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className={portalTbodyRow}>
                    <td className={portalTdStrong}>
                      <Link href={`/portal/client/invoices/${i.id}`} className="text-teal-700 hover:underline">
                        {i.invoiceNumber}
                      </Link>
                    </td>
                    <td className={`${portalTdMuted} text-right tabular-nums`}>{i.trips}</td>
                    <td className={`${portalTdStrong} text-right tabular-nums`}>{formatINR(i.subTotal)}</td>
                    <td className={`${portalTdMuted} text-right tabular-nums`}>{formatINR(i.gstAmount)}</td>
                    <td className={`${portalTdStrong} text-right tabular-nums`}>{formatINR(i.totalAmount)}</td>
                    <td className={portalTdMuted}>{formatDate(i.dueDate)}</td>
                    <td className={portalTd}>
                      <StatusBadge status={i.status} />
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
