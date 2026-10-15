import Link from "next/link";
import { redirect } from "next/navigation";
import { Route } from "lucide-react";
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
import { getVendorTrips } from "@/lib/queries";
import { formatINR, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorTripsPage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login");

  const trips = await getVendorTrips(user.vendorId);

  return (
    <div>
      <PortalPageHeader
        accent="vendor"
        title="Assigned trips"
        description="Trips allocated to your fleet — open a row for POD and advance details"
      />

      <PortalSectionCard title={`All trips (${trips.length})`}>
        {trips.length === 0 ? (
          <PortalEmptyState
            icon={Route}
            title="No trips assigned yet"
            description="Win loads by quoting on open indents."
          />
        ) : (
          <PortalTableWrap>
            <PortalTable>
              <thead>
                <tr className={portalTheadRow}>
                  <th className={portalTh}>LR No.</th>
                  <th className={portalTh}>Route</th>
                  <th className={portalTh}>Client</th>
                  <th className={portalTh}>Vehicle</th>
                  <th className={cn(portalTh, "text-right")}>Your freight</th>
                  <th className={portalTh}>Status</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={`${t.kind}-${t.id}`} className={portalTbodyRow}>
                    <td className={portalTdStrong}>
                      <Link href={t.href} className="text-primary hover:underline">
                        {t.lrNumber}
                      </Link>
                    </td>
                    <td className={portalTd}>{t.route}</td>
                    <td className={portalTdMuted}>{t.client}</td>
                    <td className={portalTdMuted}>{t.vehicle}</td>
                    <td className={`${portalTdStrong} text-right tabular-nums`}>{formatINR(t.vendorRate)}</td>
                    <td className={portalTd}>
                      <StatusBadge status={t.status} />
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
