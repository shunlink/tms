import Link from "next/link";
import { redirect } from "next/navigation";
import { Truck, PackageCheck, Wallet, Plus, ArrowRight } from "lucide-react";
import PortalPageHeader from "@/components/portal/portal-page-header";
import PortalSectionCard from "@/components/portal/portal-section-card";
import PortalEmptyState from "@/components/portal/portal-empty-state";
import PortalOverviewRow from "@/components/portal/portal-overview-row";
import StatCard from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { getClientPortalOverview } from "@/lib/queries";
import { formatINR } from "@/lib/utils";
import { PORTAL_THEME } from "@/lib/portal-theme";
import PortalBiddingPromoBanner from "@/components/portal/portal-bidding-promo-banner";

export const dynamic = "force-dynamic";

export default async function ClientOverviewPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login");

  const d = await getClientPortalOverview(user.clientId);
  const chip = PORTAL_THEME.client.chip;

  const stats = [
    { title: "Active Shipments", value: String(d.active), icon: Truck },
    { title: "Delivered", value: String(d.delivered), icon: PackageCheck },
    { title: "Outstanding", value: formatINR(d.outstanding), icon: Wallet },
  ];

  return (
    <div>
      <PortalPageHeader
        accent="client"
        title="Overview"
        description={d.clientName}
        action={
          <>
            <Link href="/portal/client/requirements/new">
              <Button className={chip}>
                <Plus className="h-4 w-4 mr-2" /> New requirement
              </Button>
            </Link>
            <Link href="/portal/client/trips">
              <Button variant="outline">View trips</Button>
            </Link>
          </>
        }
      />

      <PortalBiddingPromoBanner accent="client" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <StatCard key={s.title} icon={s.icon} value={s.value} label={s.title} accent="client" />
        ))}
      </div>

      <PortalSectionCard
        title="Recent shipments"
        description="Latest movement on your account"
        action={
          <Link
            href="/portal/client/trips"
            className="text-sm font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
          >
            See all <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        {d.recentTrips.length === 0 ? (
          <PortalEmptyState
            icon={Truck}
            title="No shipments yet"
            description="Raise a requirement when you need vehicles — we'll match you with vendors."
            action={
              <Link href="/portal/client/requirements/new">
                <Button className={chip}>Raise requirement</Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border/70">
            {d.recentTrips.map((t) => (
              <PortalOverviewRow
                key={t.id}
                title={t.lrNumber}
                subtitle={`${t.route} · ${t.vehicle}`}
                status={t.status}
              />
            ))}
          </div>
        )}
      </PortalSectionCard>
    </div>
  );
}
