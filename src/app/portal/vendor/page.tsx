import Link from "next/link";
import { redirect } from "next/navigation";
import { Truck, CheckCircle2, UploadCloud, Wallet, FileSpreadsheet, ArrowRight } from "lucide-react";
import PodPendingAlert from "@/components/pod-pending-alert";
import PortalPageHeader from "@/components/portal/portal-page-header";
import PortalSectionCard from "@/components/portal/portal-section-card";
import PortalEmptyState from "@/components/portal/portal-empty-state";
import PortalOverviewRow from "@/components/portal/portal-overview-row";
import StatCard from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { getVendorPortalOverview } from "@/lib/queries";
import { formatINR } from "@/lib/utils";
import PortalBiddingPromoBanner from "@/components/portal/portal-bidding-promo-banner";

export const dynamic = "force-dynamic";

export default async function VendorOverviewPage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login");

  const d = await getVendorPortalOverview(user.vendorId);

  const stats = [
    { title: "Active Trips", value: String(d.active), icon: Truck },
    { title: "Completed", value: String(d.delivered), icon: CheckCircle2 },
    { title: "POD pending", value: String(d.pendingPods), icon: UploadCloud },
    { title: "Pending payment", value: formatINR(d.pendingPay), icon: Wallet },
  ];

  return (
    <div>
      <PortalPageHeader
        accent="vendor"
        title="Overview"
        description={`${d.vendorName} · Paid to date ${formatINR(d.paidPay)}`}
        action={
          <>
            <Link href="/portal/vendor/indents">
              <Button variant="accent">
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Open indents
              </Button>
            </Link>
            <Link href="/portal/vendor/trips">
              <Button variant="outline">My trips</Button>
            </Link>
          </>
        }
      />

      <PortalBiddingPromoBanner accent="vendor" />

      <PodPendingAlert trips={d.pendingPodTrips} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <StatCard key={s.title} icon={s.icon} value={s.value} label={s.title} accent="vendor" />
        ))}
      </div>

      <PortalSectionCard
        title="Recent assigned trips"
        description="Tap a trip for details and POD upload"
        action={
          <Link
            href="/portal/vendor/trips"
            className="text-sm font-medium text-accent hover:underline inline-flex items-center gap-1"
          >
            See all <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        {d.recentTrips.length === 0 ? (
          <PortalEmptyState
            icon={FileSpreadsheet}
            title="No trips assigned yet"
            description="Quote on open indents to win loads for your fleet."
            action={
              <Link href="/portal/vendor/indents">
                <Button variant="accent">Browse indents</Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border/70">
            {d.recentTrips.map((t) => (
              <PortalOverviewRow
                key={t.id}
                title={t.lrNumber}
                titleHref={t.href}
                subtitle={`${t.route} · ${t.vehicle}`}
                status={t.status}
                trailing={<span className="text-base font-semibold tabular-nums">{formatINR(t.vendorRate)}</span>}
              />
            ))}
          </div>
        )}
      </PortalSectionCard>
    </div>
  );
}
