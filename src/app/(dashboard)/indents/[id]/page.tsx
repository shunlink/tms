import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, IndianRupee, FileText, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import IndentActions from "@/components/forms/indent-actions";
import IndentQuotes from "@/components/forms/indent-quotes";
import IndentForm from "@/components/forms/indent-form";
import VendorAllocationPanel from "@/components/forms/vendor-allocation-panel";
import { getSessionUser } from "@/lib/auth";
import { getIndentDetail, getIndentQuotes, getFormOptions } from "@/lib/queries";
import { isTripAdvanceClearedForTransit } from "@/lib/services/trip-advance.service";
import { hasPermission, type PermissionKey } from "@/lib/services/permission.service";
import { indentFlatToFormValues } from "@/lib/mappers/indent-form";
import IndentLiveTracking from "@/components/forms/indent-live-tracking";
import StatusBadge from "@/components/status-badge";
import PodVerificationPanel from "@/components/forms/pod-verification-panel";
import { isVendorAdvancePaidStatus } from "@/lib/advance";
import { formatINR, formatDate } from "@/lib/utils";
import { getIndentSectionOrder, type IndentDetailSection } from "@/lib/indent-section-order";

export const dynamic = "force-dynamic";

const QUOTE_VISIBLE_STATUSES = [
  "RELEASED_TO_VENDORS",
  "QUOTING",
  "VENDOR_ALLOCATED",
  "PLACEMENT_PENDING",
  "VEHICLE_PLACED",
  "DRIVER_ASSIGNED",
  "IN_TRANSIT",
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-1.5 text-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}

export default async function IndentDetailPage({ params }: { params: { id: string } }) {
  const [indent, user, quotes, { clients, vendors }] = await Promise.all([
    getIndentDetail(params.id),
    getSessionUser(),
    getIndentQuotes(params.id),
    getFormOptions(),
  ]);
  if (!indent) notFound();

  async function userCan(p: PermissionKey) {
    if (!user?.id) return false;
    if (user.role === "SUPER_ADMIN") return true;
    return hasPermission(user.id, p);
  }

  const canEdit = await userCan("indent.edit");
  const canReleaseIndent = await userCan("indent.release");
  const canVerifyPod = await userCan("pod.approve");
  const canManagePod = await userCan("pod.manage");
  const canViewPod = await userCan("pod.view");
  const canAllocate = await userCan("indent.allocate");
  const canViewFinance = (await userCan("payment.view")) || (await userCan("invoice.view"));
  const margin = indent.clientRate && indent.vendorRate ? indent.clientRate - indent.vendorRate : null;
  const vendorAllocated = Boolean(indent.vendorId);
  const vehicleReached = indent.placementStatus === "VEHICLE_REACHED";
  const driverAssigned = Boolean(indent.driverId);
  const driverVerified = Boolean(indent.driver?.otpVerified);
  const canReallocate =
    canAllocate &&
    !indent.trip &&
    ["VENDOR_ALLOCATED", "PLACEMENT_PENDING", "VEHICLE_PLACED", "DRIVER_ASSIGNED"].includes(
      indent.status
    );
  const sectionOrder = getIndentSectionOrder(indent.status);
  const advanceClearedForTransit = indent.trip
    ? await isTripAdvanceClearedForTransit(indent.trip.id)
    : false;

  const lastPing = indent.lastTracking;

  const formClients = clients.some((c) => c.id === indent.client.id)
    ? clients
    : [{ id: indent.client.id, name: indent.client.name }, ...clients];

  const sections: Record<IndentDetailSection, React.ReactNode> = {
    quotes:
      QUOTE_VISIBLE_STATUSES.includes(indent.status) ? (
        <Card key="quotes" className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle>
              Vendor Quotes {quotes.length > 0 ? ` (${quotes.length} — lowest first)` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IndentQuotes
              indentId={indent.id}
              canAllocate={canAllocate}
              initialQuotes={quotes}
              allocatedVendorId={indent.vendorId}
              allocatedVendorName={indent.vendor?.name}
              canReallocate={canReallocate}
              vendors={vendors}
            />
          </CardContent>
        </Card>
      ) : null,

    allocation: (
      <VendorAllocationPanel
        key="allocation"
        indentId={indent.id}
        indentStatus={indent.status}
        allocationMode={indent.allocationMode ?? "BIDDING"}
        vendorAllocated={vendorAllocated}
        vendor={indent.vendor}
        allocatedAt={indent.vendorAllocatedAt}
        allocatedBy={indent.allocatedBy}
        placementStatus={indent.placementStatus}
        placementDeadlineAt={indent.placementDeadlineAt}
        agreedVendorRate={indent.vendorRate}
        vendors={vendors}
        canAllocate={canAllocate}
        canReallocate={canReallocate}
        allocatedVendorId={indent.vendorId}
      />
    ),

    form: canEdit ? (
      <div key="form" className="mb-6">
        <IndentForm
          clients={formClients}
          mode="edit"
          indentId={indent.id}
          initialValues={indentFlatToFormValues(indent)}
          lockedClientId={indent.client.id}
          lockClientName={indent.client.name}
          vendorAllocated={vendorAllocated}
          vendorName={indent.vendor?.name}
          placementStatus={indent.placementStatus}
          vehicleReached={vehicleReached}
          initialVehicleReg={indent.vehicle?.registrationNumber ?? ""}
          initialDriver={{
            id: indent.driver?.id,
            name: indent.driver?.name ?? "",
            dlNumber: indent.driver?.dlNumber ?? "",
            phone: indent.driver?.phone ?? "",
            deviceType: indent.driver?.deviceType ?? "SMARTPHONE",
            otpVerified: indent.driver?.otpVerified ?? false,
          }}
          driverAssigned={driverAssigned}
          initialEwayBillRequired={indent.ewayBillRequired}
          initialEwayBill={
            indent.ewayBill
              ? {
                  mode: (indent.ewayBill.mode as "EXISTING" | "NONE" | "MANUAL") ?? "NONE",
                  ewayBillNumber: indent.ewayBill.ewayBillNumber ?? "",
                  status: indent.ewayBill.status ?? "",
                  supplierGstin: indent.ewayBill.supplierGstin ?? "",
                  recipientGstin: indent.ewayBill.recipientGstin ?? "",
                  documentType: indent.ewayBill.documentType ?? "",
                  documentNumber: indent.ewayBill.documentNumber ?? "",
                  documentDate: indent.ewayBill.documentDate
                    ? new Date(indent.ewayBill.documentDate).toISOString().slice(0, 10)
                    : "",
                  goodsDescription: indent.ewayBill.goodsDescription ?? "",
                  hsnCode: indent.ewayBill.hsnCode ?? "",
                  quantity: indent.ewayBill.quantity ?? "",
                  value: indent.ewayBill.value != null ? String(indent.ewayBill.value) : "",
                  origin: indent.ewayBill.origin ?? "",
                  destination: indent.ewayBill.destination ?? "",
                  transporterName: indent.ewayBill.transporterName ?? "",
                  transporterGstin: indent.ewayBill.transporterGstin ?? "",
                  vehicleNumber: indent.ewayBill.vehicleNumber ?? "",
                  validUntil: indent.ewayBill.validUntil
                    ? new Date(indent.ewayBill.validUntil).toISOString().slice(0, 10)
                    : "",
                  provider: indent.ewayBill.provider ?? "",
                  fetchedAt: indent.ewayBill.fetchedAt?.toISOString() ?? "",
                  source:
                    (indent.ewayBill.source as "CLIENT_PROVIDED" | "SHUNLINK_GENERATED" | "MANUAL") ??
                    "MANUAL",
                }
              : undefined
          }
        />
      </div>
    ) : (
      <Card key="form" className="mb-6 border-amber-200">
        <CardContent className="pt-6 text-sm text-slate-500">
          You do not have permission to edit this indent.
        </CardContent>
      </Card>
    ),

    tracking: (
      <Card key="tracking" className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-teal-600" /> Driver Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IndentLiveTracking indentId={indent.id} indentStatus={indent.status} lastPing={lastPing} />
        </CardContent>
      </Card>
    ),

    advance: indent.trip ? (
      <Card key="advance" className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-amber-600" /> Trip Advance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {indent.advanceSource === "TRIP" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">
                  {indent.advanceRequestNumber ?? "Advance"}
                  {isVendorAdvancePaidStatus(indent.advanceStatus)
                    ? ` · Paid ${formatINR(indent.advanceAmount)}`
                    : indent.advanceStatus === "EXTERNAL"
                      ? ` · External provider${indent.advanceExternalProvider ? ` (${indent.advanceExternalProvider})` : ""}`
                      : indent.advanceRequested
                        ? ` · Requested ${formatINR(indent.advanceRequested)}`
                        : ""}
                </p>
                {isVendorAdvancePaidStatus(indent.advanceStatus) && (
                  <p className="text-xs text-slate-500">
                    {[
                      indent.advanceMode,
                      indent.advanceReference,
                      indent.advancePaidAt ? formatDate(indent.advancePaidAt) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <StatusBadge status={indent.advanceStatus} />
            </div>
          ) : (
            <p className="text-slate-600">Advance payments are requested by the vendor after trip creation.</p>
          )}
          <Link href={`/trips/${indent.trip.id}`} className="text-blue-600 hover:underline">
            View trip {indent.trip.lrNumber}
          </Link>
        </CardContent>
      </Card>
    ) : null,

    release:
      indent.releaseCities.length > 0 ? (
        <Card key="release" className="mb-6 border-cyan-200">
          <CardHeader>
            <CardTitle>Released to vendor cities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">{indent.releaseCities.join(", ")}</p>
          </CardContent>
        </Card>
      ) : null,

    pod: canViewPod ? (
      <PodVerificationPanel
        key="pod"
        pods={indent.pods}
        canVerify={canVerifyPod}
        canManage={canManagePod}
      />
    ) : null,

    events:
      indent.importantEvents.length > 0 ? (
        <Card key="events" className="mb-6 border-rose-200">
          <CardHeader><CardTitle>Important Events</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {indent.importantEvents.map((e) => (
              <div key={e.id} className="rounded-lg border px-4 py-2 text-sm">
                <p className="font-medium">{e.title}</p>
                <p className="text-xs text-slate-500">
                  {e.severity} · {e.status} · {formatDate(e.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null,

    history:
      (indent.allocations?.length ?? 0) > 0 ? (
        <Card key="history" className="mb-6">
          <CardHeader><CardTitle>Allocation History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {indent.allocations.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-200 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {a.vendorName ?? "—"} · {formatINR(a.vendorRate)}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        a.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700"
                          : a.status === "RELEASED"
                            ? "bg-amber-100 text-amber-700"
                            : a.status === "CANCELLED"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Allocated {formatDate(a.allocatedAt)}
                    {a.deadlineAt ? ` · Deadline ${formatDate(a.deadlineAt)}` : ""}
                  </p>
                  {(a.vehicleRegistration || a.driverName) && (
                    <p className="text-xs text-slate-600 mt-1">
                      {a.vehicleRegistration ? `Vehicle: ${a.vehicleRegistration}` : ""}
                      {a.vehicleRegistration && a.driverName ? " · " : ""}
                      {a.driverName ? `Driver: ${a.driverName}` : ""}
                    </p>
                  )}
                  {a.reallocationReason && (
                    <p className="text-xs text-amber-600 mt-1">Reason: {a.reallocationReason}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null,

    documents: null,
  };

  return (
    <div className="max-w-5xl">
      <Link
        href="/indents"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Indents
      </Link>

      <div className="rounded-xl border bg-gradient-to-r from-slate-50 to-white p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{indent.indentNumber}</h1>
              <StatusBadge status={indent.status} />
            </div>
            <p className="text-slate-500 mt-1">{indent.client.name}</p>
            <p className="text-sm text-slate-600 mt-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              {indent.consignorCity || "—"} → {indent.consigneeCity || "—"}
            </p>
            {indent.requirementNumber && (
              <p className="text-xs text-slate-500 mt-1">From requirement {indent.requirementNumber}</p>
            )}
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>Indent Date</p>
            <p className="font-medium text-slate-800">{formatDate(indent.indentDate)}</p>
            {indent.trip && (
              <div className="mt-2 space-y-1">
                <Link
                  href={`/trips/${indent.trip.id}`}
                  className="inline-block text-blue-600 hover:underline"
                >
                  LR {indent.trip.lrNumber}
                </Link>
                {canViewFinance && (
                  <Link
                    href={`/finance/trips/${indent.trip.id}`}
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <IndianRupee className="h-3.5 w-3.5" /> Trip Finance
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <IndentActions
            indentId={indent.id}
            indentNumber={indent.indentNumber}
            status={indent.status}
            advanceStatus={indent.advanceStatus}
            allocationMode={indent.allocationMode ?? "BIDDING"}
            hasTrip={Boolean(indent.trip)}
            hasVehicle={Boolean(indent.vehicleId)}
            hasDriver={driverAssigned}
            driverVerified={driverVerified}
            vendorAllocated={vendorAllocated}
            advanceClearedForTransit={advanceClearedForTransit}
            canReleasePermission={canReleaseIndent}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <IndianRupee className="h-3.5 w-3.5" /> Client Rate
            </p>
            <p className="text-xl font-bold text-slate-900">
              {indent.clientRate ? formatINR(indent.clientRate) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <IndianRupee className="h-3.5 w-3.5" /> Vendor Rate
            </p>
            <p className="text-xl font-bold text-slate-900">
              {indent.vendorRate ? formatINR(indent.vendorRate) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500">Margin</p>
            <p className="text-xl font-bold text-green-600">{margin != null ? formatINR(margin) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500">Advance Paid</p>
            <p className="text-xl font-bold text-amber-600">
              {indent.advanceAmount ? formatINR(indent.advanceAmount) : "—"}
            </p>
            {!indent.advanceAmount && indent.advanceSource === "TRIP" && (
              <p className="text-xs text-slate-500 mt-1">{indent.advanceStatus.replace(/_/g, " ").toLowerCase()}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {sectionOrder.map((key) => sections[key])}
    </div>
  );
}
