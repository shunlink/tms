import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";
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
import StatusBadge from "@/components/status-badge";
import { getSessionUser } from "@/lib/auth";
import { getClientRequirements } from "@/lib/queries";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { PORTAL_THEME } from "@/lib/portal-theme";

export const dynamic = "force-dynamic";

export default async function ClientRequirementsPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login");

  const requirements = await getClientRequirements(user.clientId);

  return (
    <div>
      <PortalPageHeader
        accent="client"
        title="Requirements"
        description="Vehicle requirements you have raised"
        action={
          <Link href="/portal/client/requirements/new">
            <Button className={PORTAL_THEME.client.chip}>
              <Plus className="h-4 w-4 mr-2" /> New requirement
            </Button>
          </Link>
        }
      />

      <PortalSectionCard title={`All requirements (${requirements.length})`}>
        {requirements.length === 0 ? (
          <PortalEmptyState
            icon={ClipboardList}
            title="No requirements yet"
            description="Create a requirement when you need trucks on a lane."
            action={
              <Link href="/portal/client/requirements/new">
                <Button className={PORTAL_THEME.client.chip}>Create requirement</Button>
              </Link>
            }
          />
        ) : (
          <PortalTableWrap>
            <PortalTable>
              <thead>
                <tr className={portalTheadRow}>
                  <th className={portalTh}>Req No.</th>
                  <th className={portalTh}>Route</th>
                  <th className={portalTh}>Vehicle type</th>
                  <th className={cn(portalTh, "text-right")}>Allocated</th>
                  <th className={portalTh}>Expected</th>
                  <th className={cn(portalTh, "text-right")}>Quoted rate</th>
                  <th className={portalTh}>Status</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => (
                  <tr key={r.id} className={portalTbodyRow}>
                    <td className={portalTdStrong}>{r.reqNumber}</td>
                    <td className={portalTd}>{r.route}</td>
                    <td className={portalTdMuted}>{r.vehicleType.replace(/_/g, " ")}</td>
                    <td className={`${portalTdMuted} text-right tabular-nums`}>
                      {r.allocated}/{r.quantity}
                    </td>
                    <td className={portalTdMuted}>{formatDate(r.expectedDate)}</td>
                    <td className={`${portalTdStrong} text-right tabular-nums`}>
                      {r.clientRate ? formatINR(r.clientRate) : "—"}
                    </td>
                    <td className={portalTd}>
                      <StatusBadge status={r.status} />
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
