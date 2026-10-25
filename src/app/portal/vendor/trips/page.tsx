import Link from "next/link";
import { redirect } from "next/navigation";
import { Route, Truck, ChevronRight, FileSpreadsheet, ArrowRight } from "lucide-react";
import StatusBadge from "@/components/status-badge";
import { getSessionUser } from "@/lib/auth";
import { getVendorTrips } from "@/lib/queries";
import { formatINR } from "@/lib/utils";
import PortalPage from "@/components/portal/portal-page";
import PortalTableExport from "@/components/portal/portal-table-export";

export const dynamic = "force-dynamic";

export default async function VendorTripsPage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login?portal=transporter");

  const trips = await getVendorTrips(user.vendorId);

  const bulkAdvanceBanners: { indentId: string; indentNumber: string | null; count: number }[] = [];
  const indentTripCounts = new Map<string, { indentNumber: string | null; count: number }>();
  for (const row of trips) {
    if (row.kind !== "trip" || !row.indentId) continue;
    const prev = indentTripCounts.get(row.indentId);
    if (prev) {
      prev.count += 1;
    } else {
      indentTripCounts.set(row.indentId, {
        indentNumber: row.indentNumber ?? null,
        count: 1,
      });
    }
  }
  for (const [indentId, meta] of Array.from(indentTripCounts.entries())) {
    if (meta.count >= 2) {
      bulkAdvanceBanners.push({ indentId, indentNumber: meta.indentNumber, count: meta.count });
    }
  }

  const tripExportColumns = [
    { key: "lrNumber", header: "LR No." },
    { key: "route", header: "Route" },
    { key: "client", header: "Client" },
    { key: "vehicle", header: "Vehicle" },
    { key: "vendorRate", header: "Freight" },
    { key: "status", header: "Status" },
  ];
  const tripExportRows = trips.map((t) => ({
    lrNumber: t.lrNumber,
    route: t.route,
    client: t.client,
    vehicle: t.vehicle,
    vendorRate: formatINR(t.vendorRate),
    status: t.status,
  }));

  return (
    <PortalPage>
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Assigned Trips
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Trips allocated to your fleet — click any trip to upload POD, request advances, or view details.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 text-xs font-semibold border border-sky-200/60">
          <Truck className="h-4 w-4" />
          <span>{trips.length} Total Trips</span>
        </div>
      </div>

      {bulkAdvanceBanners.length > 0 && (
        <div className="space-y-3">
          {bulkAdvanceBanners.map((b) => (
            <div
              key={b.indentId}
              className="bg-amber-50 border border-amber-200/80 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm text-amber-950">
                <span className="font-bold">{b.indentNumber ?? "Indent"}</span> has {b.count} trips — request
                advance for all LRs at once.
              </p>
              <Link
                href={`/portal/vendor/indents/${b.indentId}/bulk-advance`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 text-xs font-bold shadow-xs transition-colors"
              >
                Request bulk advance
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Trips Card & Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-950">All Assigned Trips</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">Showing {trips.length} entries</span>
            <PortalTableExport fileName="vendor-trips" columns={tripExportColumns} rows={tripExportRows} />
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4 border border-sky-100">
              <Route className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-gray-950">No trips assigned yet</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Win loads by quoting on open indents. Once assigned, you can manage vehicle details and upload PODs here.
            </p>
            <div className="mt-5">
              <Link
                href="/portal/vendor/indents"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 text-xs font-bold shadow-xs transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Browse Open Indents</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain -mx-5 sm:-mx-6 px-5 sm:px-6">
            <table className="w-full text-left text-xs sm:text-sm min-w-[720px]">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">LR No.</th>
                  <th className="px-6 py-3.5">Route</th>
                  <th className="px-6 py-3.5">Client</th>
                  <th className="px-6 py-3.5">Vehicle</th>
                  <th className="px-6 py-3.5 text-right">Your Freight</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {trips.map((t) => (
                  <tr
                    key={`${t.kind}-${t.id}`}
                    className="hover:bg-gray-50/80 transition-colors group"
                  >
                    <td className="px-6 py-4 font-bold text-gray-950">
                      <Link
                        href={t.href}
                        className="text-gray-950 hover:text-blue-600 transition-colors inline-flex items-center gap-1.5"
                      >
                        {t.lrNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">{t.route}</td>
                    <td className="px-6 py-4 text-gray-500">{t.client}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200/80 font-mono text-xs text-gray-700 font-medium">
                        <Truck className="h-3 w-3 text-gray-400" />
                        {t.vehicle}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-950 tabular-nums">
                      {formatINR(t.vendorRate)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={t.href}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 p-1 rounded-md hover:bg-blue-50 transition-colors"
                      >
                        <span>Details</span>
                        <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalPage>
  );
}
