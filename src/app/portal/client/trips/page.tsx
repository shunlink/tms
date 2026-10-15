import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Route } from "lucide-react";
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
import { getClientTrips } from "@/lib/queries";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientTripsPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login");

  const trips = await getClientTrips(user.clientId);

  return (
    <div>
      <PortalPageHeader
        accent="client"
        title="My trips"
        description="Track shipments, invoices, and last known location"
      />

      <PortalSectionCard title={`All shipments (${trips.length})`}>
        {trips.length === 0 ? (
          <PortalEmptyState
            icon={Route}
            title="No shipments yet"
            description="Trips appear here after vendors are allocated to your requirements."
          />
        ) : (
          <PortalTableWrap>
            <PortalTable>
              <thead>
                <tr className={portalTheadRow}>
                  <th className={portalTh}>LR No.</th>
                  <th className={portalTh}>Route</th>
                  <th className={portalTh}>Vehicle</th>
                  <th className={portalTh}>Vendor</th>
                  <th className={portalTh}>Invoice</th>
                  <th className={portalTh}>Last location</th>
                  <th className={portalTh}>Status</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id} className={portalTbodyRow}>
                    <td className={portalTdStrong}>{t.lrNumber}</td>
                    <td className={portalTd}>{t.route}</td>
                    <td className={portalTdMuted}>{t.vehicle}</td>
                    <td className={portalTdMuted}>{t.vendor}</td>
                    <td className={portalTd}>
                      {t.invoice ? (
                        <div>
                          <Link
                            href={`/portal/client/invoices/${t.invoice.id}`}
                            className="text-teal-700 hover:underline font-medium"
                          >
                            {t.invoice.invoiceNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                            {formatINR(t.invoice.paidAmount)} / {formatINR(t.invoice.totalAmount)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={portalTd}>
                      {t.lastPing ? (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${t.lastPing.lat}&mlon=${t.lastPing.lng}#map=9/${t.lastPing.lat}/${t.lastPing.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-teal-700 hover:underline font-medium"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {t.lastPing.note ?? "View"}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={portalTd}>
                      <StatusBadge status={t.displayStatus} />
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
