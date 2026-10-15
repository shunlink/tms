import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Truck,
  Package,
  MapPin,
  ArrowRight,
  Plus,
  Inbox,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getClientTrips } from "@/lib/queries";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientTripsPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login?portal=client");

  const trips = await getClientTrips(user.clientId);

  const activeCount = trips.filter((t) =>
    ["IN_TRANSIT", "AT_PICKUP", "LOADING", "UNLOADING", "ALLOCATED"].includes(t.displayStatus)
  ).length;

  const deliveredCount = trips.filter((t) =>
    ["DELIVERED", "SETTLED"].includes(t.displayStatus)
  ).length;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight leading-tight">
            Shipments
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Track real-time movement, vehicles, vendor allocations, and billing status
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/portal/client/requirements/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold text-xs sm:text-sm shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Requirement</span>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          METRICS CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">In Transit / Active</p>
              <p className="text-2xl font-extrabold text-gray-950 mt-0.5">{activeCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Delivered</p>
              <p className="text-2xl font-extrabold text-gray-950 mt-0.5">{deliveredCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Shipments</p>
              <p className="text-2xl font-extrabold text-gray-950 mt-0.5">{trips.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SHIPMENTS TABLE CARD
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-950">
              All Shipments ({trips.length})
            </h2>
            <p className="text-xs text-gray-500">
              Complete movement history and live vehicle tracking
            </p>
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-xl bg-gray-50/60 border border-dashed border-gray-200">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-[#D97706] flex items-center justify-center mx-auto mb-3">
              <Inbox className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">No shipments yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              Trips appear here once vehicles are allocated to your requirements.
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
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-5 sm:px-6">LR / Shipment ID</th>
                  <th className="py-3 px-3">Route</th>
                  <th className="py-3 px-3">Vehicle</th>
                  <th className="py-3 px-3">Vendor</th>
                  <th className="py-3 px-3">Invoice</th>
                  <th className="py-3 px-3">Live Location</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {trips.map((t) => {
                  let badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                  if (t.displayStatus === "DELIVERED" || t.displayStatus === "SETTLED") {
                    badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  } else if (t.displayStatus === "CANCELLED") {
                    badgeColor = "bg-gray-100 text-gray-600 border-gray-200";
                  } else if (["AT_PICKUP", "LOADING"].includes(t.displayStatus)) {
                    badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                  }

                  return (
                    <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* LR / Trip ID */}
                      <td className="py-3.5 px-5 sm:px-6 font-semibold text-gray-900 flex items-center gap-2">
                        <Truck className="h-4 w-4 text-gray-400 shrink-0" />
                        <span>{t.lrNumber || `TRP-${t.id.slice(-6)}`}</span>
                      </td>

                      {/* Route */}
                      <td className="py-3.5 px-3 text-gray-800 font-medium">{t.route}</td>

                      {/* Vehicle */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200/80 inline-block">
                          {t.vehicle}
                        </span>
                      </td>

                      {/* Vendor */}
                      <td className="py-3.5 px-3 text-gray-600">{t.vendor}</td>

                      {/* Invoice */}
                      <td className="py-3.5 px-3">
                        {t.invoice ? (
                          <div>
                            <Link
                              href={`/portal/client/invoices/${t.invoice.id}`}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                            >
                              <span>{t.invoice.invoiceNumber}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                            <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                              {formatINR(t.invoice.paidAmount)} / {formatINR(t.invoice.totalAmount)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Live Location */}
                      <td className="py-3.5 px-3">
                        {t.lastPing ? (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${t.lastPing.lat}&mlon=${t.lastPing.lng}#map=9/${t.lastPing.lat}/${t.lastPing.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 text-[11px] font-medium transition-colors"
                          >
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{t.lastPing.note ?? "View Location"}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeColor}`}
                        >
                          {t.displayStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
