import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Truck,
  CheckCircle2,
  FileText,
  Wallet,
  FileSpreadsheet,
  ArrowRight,
  ChevronRight,
  MoreVertical,
  Calendar,
  UploadCloud,
  Receipt,
} from "lucide-react";
import PodPendingAlert from "@/components/pod-pending-alert";
import PortalBiddingPromoBanner from "@/components/portal/portal-bidding-promo-banner";
import { getSessionUser } from "@/lib/auth";
import { getVendorPortalOverview } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { formatINR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorOverviewPage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login?portal=transporter");

  const [d, tripsWithDates, vendorPayments] = await Promise.all([
    getVendorPortalOverview(user.vendorId),
    prisma.trip.findMany({
      where: { vendorId: user.vendorId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        lrNumber: true,
        routeFrom: true,
        routeTo: true,
        vendorRate: true,
        status: true,
        createdAt: true,
        deliveredAt: true,
        podReceivedAt: true,
        tripClosedAt: true,
        vehicle: { select: { registrationNumber: true } },
      },
    }),
    prisma.vendorPayment.findMany({
      where: { vendorId: user.vendorId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        referenceNo: true,
        chequeNumber: true,
        paidAt: true,
        createdAt: true,
        amount: true,
        netPayable: true,
        trip: { select: { lrNumber: true } },
      },
    }),
  ]);

  // Construct real chronological activity items from database
  const activityItems: Array<{
    id: string;
    dotColor: string;
    title: string;
    subtitle: string;
    timeLabel: string;
    timestamp: number;
  }> = [];

  tripsWithDates.forEach((t) => {
    if (t.tripClosedAt || t.status === "CLOSED" || t.status === "COMPLETED") {
      const time = t.tripClosedAt || t.createdAt;
      activityItems.push({
        id: `closed-${t.id}`,
        dotColor: "bg-emerald-500",
        title: `Trip closed — ${t.lrNumber}`,
        subtitle: `${t.routeFrom} → ${t.routeTo}`,
        timeLabel: formatDate(time),
        timestamp: time.getTime(),
      });
    }
    if (t.podReceivedAt) {
      activityItems.push({
        id: `pod-${t.id}`,
        dotColor: "bg-blue-500",
        title: `POD uploaded — ${t.lrNumber}`,
        subtitle: `${t.routeFrom} → ${t.routeTo}`,
        timeLabel: formatDate(t.podReceivedAt),
        timestamp: t.podReceivedAt.getTime(),
      });
    }
    activityItems.push({
      id: `assigned-${t.id}`,
      dotColor: "bg-amber-500",
      title: `Trip assigned — ${t.lrNumber}`,
      subtitle: `${t.routeFrom} → ${t.routeTo}`,
      timeLabel: formatDate(t.createdAt),
      timestamp: t.createdAt.getTime(),
    });
  });

  vendorPayments.forEach((p) => {
    const time = p.paidAt || p.createdAt;
    activityItems.push({
      id: `pay-${p.id}`,
      dotColor: "bg-purple-500",
      title: `Payment initiated — ${p.referenceNo || p.chequeNumber || "PAY-" + p.id.slice(-6)}`,
      subtitle: p.trip?.lrNumber ? `For ${p.trip.lrNumber}` : `Amount: ${formatINR(Number(p.netPayable || p.amount))}`,
      timeLabel: formatDate(time),
      timestamp: time.getTime(),
    });
  });

  activityItems.sort((a, b) => b.timestamp - a.timestamp);
  const displayedActivity = activityItems.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          HERO BANNER (Panoramic truck background + Greeting + Action Buttons)
          ========================================================================= */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs bg-gradient-to-r from-[#CAD4E0] via-[#DCE4EE] to-[#E8EDF3] p-6 sm:p-8 lg:p-9 min-h-[170px] flex items-center justify-between">
        {/* Right truck panorama illustration with subtle soft fade */}
        <div
          className="hidden md:block absolute right-0 top-0 bottom-0 w-3/5 bg-cover bg-right bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: "url(/images/vendor-hero-panorama.jpg)",
            maskImage: "linear-gradient(to right, transparent 0%, black 25%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 25%)",
          }}
        />

        {/* Left greeting and action buttons */}
        <div className="relative z-10 max-w-xl space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Good Morning,</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight flex items-center gap-2">
              <span>{d.vendorName}</span>
              <span role="img" aria-label="wave">👋</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 font-normal">
              Your trips, updates and payments — all in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/portal/vendor/indents"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F5D33C] hover:bg-[#ebd034] text-gray-950 font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>View Open Indents</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/portal/vendor/trips"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-200/90 font-semibold text-xs sm:text-sm shadow-2xs transition-all active:scale-[0.98]"
            >
              My Trips
            </Link>
          </div>
        </div>
      </div>

      <PortalBiddingPromoBanner accent="vendor" />

      {d.pendingPodTrips.length > 0 && (
        <PodPendingAlert trips={d.pendingPodTrips} />
      )}

      {/* =========================================================================
          4 METRIC CARDS (Active Trips, Completed, POD Pending, Pending Payment)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Active Trips */}
        <Link
          href="/portal/vendor/trips"
          className="group bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-2xs flex items-center justify-between hover:border-amber-200 hover:shadow-xs transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100/60">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-950 tabular-nums leading-none">
                {d.active}
              </p>
              <p className="text-xs font-semibold text-gray-500 mt-1">Active Trips</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* 2. Completed */}
        <Link
          href="/portal/vendor/trips"
          className="group bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-2xs flex items-center justify-between hover:border-emerald-200 hover:shadow-xs transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/60">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-950 tabular-nums leading-none">
                {d.delivered}
              </p>
              <p className="text-xs font-semibold text-gray-500 mt-1">Completed</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* 3. POD Pending */}
        <Link
          href="/portal/vendor/trips"
          className="group bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-2xs flex items-center justify-between hover:border-blue-200 hover:shadow-xs transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100/60">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-950 tabular-nums leading-none">
                {d.pendingPods}
              </p>
              <p className="text-xs font-semibold text-gray-500 mt-1">POD Pending</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* 4. Pending Payment */}
        <Link
          href="/portal/vendor/payments"
          className="group bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-2xs flex items-center justify-between hover:border-purple-200 hover:shadow-xs transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100/60">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-950 tabular-nums leading-none">
                {formatINR(d.pendingPay)}
              </p>
              <p className="text-xs font-semibold text-gray-500 mt-1">Pending Payment</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* =========================================================================
          LOWER CONTENT GRID (Left 8 cols: Trips & Activity | Right 4 cols: Quick Actions & Summary)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card: Recent Assigned Trips */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-950">Recent Assigned Trips</h2>
                <p className="text-xs text-gray-500">Tap a trip for details and POD upload</p>
              </div>
              <Link
                href="/portal/vendor/trips"
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                See all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {d.recentTrips.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <Truck className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">No trips assigned yet</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Quote on open indents to win loads for your fleet.
                </p>
                <div className="mt-4">
                  <Link
                    href="/portal/vendor/indents"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5D33C] hover:bg-[#ebd034] text-gray-950 text-xs font-bold shadow-xs transition-colors"
                  >
                    Browse Open Indents
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 pt-1">
                {d.recentTrips.map((t, idx) => {
                  const tripRecord = tripsWithDates.find((item) => item.id === t.id);
                  const isClosed = t.status === "CLOSED" || t.status === "DELIVERED" || t.status === "Trip Closed";
                  const isInvoiced = t.status === "INVOICED" || t.status === "Invoiced";
                  const dotColor = isClosed ? "bg-amber-500" : isInvoiced ? "bg-blue-500" : "bg-emerald-500";
                  return (
                    <div
                      key={t.id}
                      className="group flex flex-wrap items-center justify-between gap-3 py-3.5 hover:bg-gray-50/70 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <span className={`h-2.5 w-2.5 rounded-full ${dotColor} shrink-0`} />
                        <div>
                          <Link
                            href={t.href}
                            className="font-bold text-xs sm:text-sm text-gray-900 group-hover:text-blue-600 transition-colors"
                          >
                            {t.lrNumber}
                          </Link>
                          <p className="text-xs text-gray-500">{t.route}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200/80 text-xs font-mono text-gray-700 font-medium">
                          <Truck className="h-3.5 w-3.5 text-gray-400" />
                          <span>{t.vehicle}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span>{formatDate(tripRecord?.createdAt || new Date())}</span>
                      </div>

                      <div className="font-bold text-xs sm:text-sm text-gray-900 tabular-nums">
                        {formatINR(t.vendorRate)}
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isClosed
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                              : isInvoiced
                              ? "bg-sky-50 text-sky-700 border-sky-200/60"
                              : "bg-amber-50 text-amber-700 border-amber-200/60"
                          }`}
                        >
                          {t.status.replace(/_/g, " ")}
                        </span>

                        <div className="flex items-center gap-1 text-gray-400">
                          <MoreVertical className="h-4 w-4 hover:text-gray-600 cursor-pointer" />
                          <Link href={t.href}>
                            <ChevronRight className="h-4 w-4 hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card: Recent Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-950">Recent Activity</h2>
                <p className="text-xs text-gray-500">Latest updates on your trips and payments</p>
              </div>
              <Link
                href="/portal/vendor/trips"
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                See all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {displayedActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No recent activity recorded yet.
              </div>
            ) : (
              <div className="pt-4 relative pl-3 space-y-4 before:absolute before:left-4 before:top-6 before:bottom-4 before:w-0.5 before:bg-gray-100">
                {displayedActivity.map((item) => (
                  <div key={item.id} className="relative flex items-start justify-between gap-4 pl-6 group">
                    <span className={`absolute left-0 top-1 h-2.5 w-2.5 rounded-full ${item.dotColor} ring-4 ring-white shrink-0`} />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium shrink-0 tabular-nums">
                      {item.timeLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card: Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-gray-950 mb-3">Quick Actions</h2>
            <div className="space-y-1.5">
              <Link
                href="/portal/vendor/indents"
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100/50">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      View Open Indents
                    </p>
                    <p className="text-xs text-gray-500">Check and accept new indents</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/portal/vendor/trips"
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100/50">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      My Assigned Trips
                    </p>
                    <p className="text-xs text-gray-500">View all your trips</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/portal/vendor/trips"
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/50">
                    <UploadCloud className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      Upload POD
                    </p>
                    <p className="text-xs text-gray-500">Submit delivery proof</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/portal/vendor/payments"
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100/50">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      Payments
                    </p>
                    <p className="text-xs text-gray-500">View invoices and payment status</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          {/* Card: Payment Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-amber-500" />
                <h2 className="text-base sm:text-lg font-bold text-gray-950">Payment Summary</h2>
              </div>
              <Link
                href="/portal/vendor/payments"
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                View all →
              </Link>
            </div>

            <div className="pt-3">
              <p className="text-xs font-medium text-gray-500">Pending Payment</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-950 tabular-nums mt-0.5 mb-4">
                {formatINR(d.pendingPay)}
              </p>

              <div className="bg-[#F8FAFC] border border-gray-100 rounded-xl p-6 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-gray-900">All caught up!</p>
                <p className="text-xs text-gray-500 mt-1">
                  You have no pending payments at the moment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
