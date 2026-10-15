import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Truck,
  Package,
  Wallet,
  ArrowRight,
  ChevronRight,
  MoreVertical,
  Plus,
  Search,
  Headphones,
  Inbox,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getClientPortalOverview } from "@/lib/queries";
import { formatINR } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClientOverviewPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login?portal=client");

  const [d, recentRequirements, recentTripsForActivity] = await Promise.all([
    getClientPortalOverview(user.clientId),
    prisma.requirement.findMany({
      where: { clientId: user.clientId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        reqNumber: true,
        routeFrom: true,
        routeTo: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.trip.findMany({
      where: { clientId: user.clientId },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        lrNumber: true,
        routeFrom: true,
        routeTo: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  // Combine real activities
  type ActivityItem = {
    id: string;
    title: string;
    subtitle: string;
    dotColor: string;
    time: string;
    timestamp: Date;
  };

  const activities: ActivityItem[] = [
    ...recentTripsForActivity.map((t) => ({
      id: `trip-${t.id}`,
      title: `Shipment update — ${t.lrNumber || t.id.slice(-6)}`,
      subtitle: `${t.routeFrom} → ${t.routeTo} · Status: ${t.status}`,
      dotColor: t.status === "DELIVERED" ? "bg-emerald-500" : "bg-blue-500",
      time: new Date(t.updatedAt).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: t.updatedAt,
    })),
    ...recentRequirements.map((r) => ({
      id: `req-${r.id}`,
      title: `Requirement submitted — ${r.reqNumber || r.id.slice(-6)}`,
      subtitle: `${r.routeFrom} → ${r.routeTo} · Status: ${r.status}`,
      dotColor: "bg-amber-500",
      time: new Date(r.createdAt).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: r.createdAt,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

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
              <span>{d.clientName}</span>
              <span role="img" aria-label="wave">👋</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 font-normal">
              Your transportation, all in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/portal/client/requirements/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F5D33C] hover:bg-[#ebd034] text-gray-950 font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Create Requirement</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/portal/client/trips"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-200/90 font-semibold text-xs sm:text-sm shadow-2xs transition-all active:scale-[0.98]"
            >
              My Shipments
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3 KPI CARDS (Real Database Metrics Only)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Shipments */}
        <Link
          href="/portal/client/trips"
          className="bg-white rounded-2xl border border-gray-200/80 p-5 hover:border-gray-300 hover:shadow-xs transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Active Shipments</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-extrabold text-gray-950">{d.active}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>

        {/* Delivered */}
        <Link
          href="/portal/client/trips"
          className="bg-white rounded-2xl border border-gray-200/80 p-5 hover:border-gray-300 hover:shadow-xs transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Delivered</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-extrabold text-gray-950">{d.delivered}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>

        {/* Outstanding */}
        <Link
          href="/portal/client/invoices"
          className="bg-white rounded-2xl border border-gray-200/80 p-5 hover:border-gray-300 hover:shadow-xs transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Outstanding</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-extrabold text-gray-950">
                  {formatINR(d.outstanding)}
                </span>
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
      </div>

      {/* =========================================================================
          MAIN GRID: 2 COLUMNS (Left 8 cols, Right 4 cols)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card: Recent Shipments */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-950">Recent Shipments</h2>
                <p className="text-xs text-gray-500">Latest movement on your account</p>
              </div>
              <Link
                href="/portal/client/trips"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
              >
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Real Shipments Table or Empty State */}
            {d.recentTrips.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-xl bg-gray-50/60 border border-dashed border-gray-200">
                <div className="h-12 w-12 rounded-2xl bg-amber-50 text-[#D97706] flex items-center justify-center mx-auto mb-3">
                  <Inbox className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">No shipments yet</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                  Raise a requirement when you need vehicles — we&apos;ll match you with verified transporters.
                </p>
                <Link
                  href="/portal/client/requirements/new"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold text-xs shadow-2xs transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Raise Requirement</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 sm:-mx-6">
                <table className="w-full text-left border-collapse min-w-[550px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="py-2.5 px-5 sm:px-6">Shipment ID</th>
                      <th className="py-2.5 px-3">Route</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Vehicle</th>
                      <th className="py-2.5 px-3">Vendor</th>
                      <th className="py-2.5 px-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {d.recentTrips.map((t) => {
                      let badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                      if (t.status === "DELIVERED" || t.status === "SETTLED") {
                        badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      } else if (t.status === "CANCELLED") {
                        badgeColor = "bg-gray-100 text-gray-600 border-gray-200";
                      }

                      return (
                        <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 px-5 sm:px-6 font-semibold text-gray-900 flex items-center gap-2">
                            <Truck className="h-4 w-4 text-gray-400 shrink-0" />
                            <span>{t.lrNumber || `TRP-${t.id.slice(-6)}`}</span>
                          </td>
                          <td className="py-3 px-3 text-gray-600 font-medium">{t.route}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeColor}`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-600 font-mono text-[11px]">
                            {t.vehicle}
                          </td>
                          <td className="py-3 px-3 text-gray-500">{t.vendor}</td>
                          <td className="py-3 px-4 text-right text-gray-400 hover:text-gray-600">
                            <Link href={`/portal/client/trips/${t.id}`}>
                              <MoreVertical className="h-4 w-4 inline" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Split Row: Recent Activity & Need Support */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Recent Activity (7 cols) */}
            <div className="md:col-span-7 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-950">Recent Activity</h3>
                  <p className="text-[11px] text-gray-500">
                    Latest updates on your shipments and requirements
                  </p>
                </div>
                <Link
                  href="/portal/client/trips"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  See all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Real Activity Timeline or Empty State */}
              {activities.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  No recent activity recorded yet.
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-3">
                      <span className={`h-2 w-2 rounded-full ${act.dotColor} mt-1.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 leading-snug">
                          {act.title}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">{act.subtitle}</p>
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0">{act.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Need Support? (5 cols) */}
            <div className="md:col-span-5 rounded-2xl bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/50 border border-blue-100/70 p-5 flex flex-col justify-between shadow-2xs">
              <div>
                <h3 className="text-sm font-bold text-gray-950 mb-1">Need Support?</h3>
                <p className="text-xs text-gray-600 mb-4">Our team is here to help you.</p>
                <Link
                  href="mailto:support@shunlink.in"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors shadow-2xs"
                >
                  <span>Contact Support</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="pt-4 flex justify-end">
                <div className="h-16 w-16 rounded-2xl bg-blue-100/80 flex items-center justify-center text-blue-600 shadow-sm">
                  <Headphones className="h-8 w-8" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
            <h2 className="text-base font-bold text-gray-950">Quick Actions</h2>
            <p className="text-xs text-gray-500 mb-5">Get things done, faster</p>

            <div className="space-y-3.5">
              {/* Action 1: Create Requirement */}
              <Link
                href="/portal/client/requirements/new"
                className="group flex items-center justify-between p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]/70 hover:border-[#F5D33C] transition-all hover:shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-gray-950 group-hover:text-amber-900 transition-colors">
                      Create Requirement
                    </p>
                    <p className="text-[11px] text-gray-600">Raise a new transport requirement</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 transition-colors" />
              </Link>

              {/* Action 2: Track a Shipment */}
              <Link
                href="/portal/client/trips"
                className="group flex items-center justify-between p-4 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE]/70 hover:border-[#3B82F6] transition-all hover:shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-full bg-[#DBEAFE] text-[#1E40AF] flex items-center justify-center shrink-0">
                    <Search className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-gray-950 group-hover:text-blue-900 transition-colors">
                      Track a Shipment
                    </p>
                    <p className="text-[11px] text-gray-600">Get real-time shipment updates</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
