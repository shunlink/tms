import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  Inbox,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getClientRequirements } from "@/lib/queries";
import { formatINR, formatDate } from "@/lib/utils";
import PortalPage from "@/components/portal/portal-page";
import PortalTableExport from "@/components/portal/portal-table-export";

export const dynamic = "force-dynamic";

export default async function ClientRequirementsPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login?portal=client");

  const requirements = await getClientRequirements(user.clientId);

  const openCount = requirements.filter((r) =>
    ["OPEN", "ALLOCATED", "PENDING"].includes(r.status)
  ).length;

  const fulfilledCount = requirements.filter((r) =>
    ["FULFILLED", "COMPLETED"].includes(r.status)
  ).length;

  const requirementExportColumns = [
    { key: "reqNumber", header: "Requirement No." },
    { key: "route", header: "Route" },
    { key: "vehicleType", header: "Vehicle Type" },
    { key: "allocated", header: "Allocated" },
    { key: "expectedDate", header: "Expected Date" },
    { key: "clientRate", header: "Target Rate" },
    { key: "status", header: "Status" },
  ];
  const requirementExportRows = requirements.map((r) => ({
    reqNumber: r.reqNumber,
    route: r.route,
    vehicleType: r.vehicleType.replace(/_/g, " "),
    allocated: `${r.allocated} / ${r.quantity}`,
    expectedDate: formatDate(r.expectedDate),
    clientRate: r.clientRate ? formatINR(r.clientRate) : "",
    status: r.status,
  }));

  return (
    <PortalPage>
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight leading-tight">
            Requirements
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Freight transport indents and vehicle requests raised across your lanes
          </p>
        </div>
        <div>
          <Link
            href="/portal/client/requirements/new"
            data-portal-mutate
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold text-xs sm:text-sm shadow-xs transition-colors w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Create Requirement</span>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          METRICS CARDS
          ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Active / Open</p>
              <p className="text-2xl font-extrabold text-gray-950 mt-0.5">{openCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Fulfilled</p>
              <p className="text-2xl font-extrabold text-gray-950 mt-0.5">{fulfilledCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Requirements</p>
              <p className="text-2xl font-extrabold text-gray-950 mt-0.5">
                {requirements.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          REQUIREMENTS TABLE CARD
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-950">
              All Requirements ({requirements.length})
            </h2>
            <p className="text-xs text-gray-500">
              Vehicles requested, supplier allocation progress, and quoted rates
            </p>
          </div>
          <PortalTableExport
            fileName="client-requirements"
            columns={requirementExportColumns}
            rows={requirementExportRows}
          />
        </div>

        {requirements.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-xl bg-gray-50/60 border border-dashed border-gray-200">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-[#D97706] flex items-center justify-center mx-auto mb-3">
              <Inbox className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">No requirements yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              Create a requirement when you need trucks on a lane — our operations team will match you with verified transporters.
            </p>
            <Link
              href="/portal/client/requirements/new"
            data-portal-mutate
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold text-xs shadow-2xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Requirement</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-5 sm:px-6">Requirement No.</th>
                  <th className="py-3 px-3">Route</th>
                  <th className="py-3 px-3">Vehicle Type</th>
                  <th className="py-3 px-3 text-right">Allocated</th>
                  <th className="py-3 px-3">Expected Date</th>
                  <th className="py-3 px-3 text-right">Target Rate (₹)</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {requirements.map((r) => {
                  let badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                  if (r.status === "FULFILLED" || r.status === "COMPLETED") {
                    badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  } else if (r.status === "CANCELLED") {
                    badgeColor = "bg-gray-100 text-gray-600 border-gray-200";
                  } else if (r.status === "OPEN") {
                    badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                  }

                  return (
                    <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Req No. */}
                      <td className="py-3.5 px-5 sm:px-6 font-semibold text-gray-900 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-gray-400 shrink-0" />
                        <span>{r.reqNumber}</span>
                      </td>

                      {/* Route */}
                      <td className="py-3.5 px-3 text-gray-800 font-medium">{r.route}</td>

                      {/* Vehicle Type */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200/80 inline-block capitalize">
                          {r.vehicleType.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Allocated */}
                      <td className="py-3.5 px-3 text-right tabular-nums text-gray-700 font-medium">
                        <span className="font-bold text-gray-950">{r.allocated}</span>
                        <span className="text-gray-400"> / {r.quantity}</span>
                      </td>

                      {/* Expected Date */}
                      <td className="py-3.5 px-3 text-gray-600">
                        {formatDate(r.expectedDate)}
                      </td>

                      {/* Target Rate */}
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-gray-900 tabular-nums">
                        {r.clientRate ? formatINR(r.clientRate) : "—"}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeColor}`}
                        >
                          {r.status}
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
    </PortalPage>
  );
}
