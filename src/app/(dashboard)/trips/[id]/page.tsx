import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, IndianRupee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TripStatusActions from "@/components/forms/trip-status-actions";
import DocumentUpload from "@/components/forms/document-upload";
import PodUpload from "@/components/forms/pod-upload";
import TripPayments from "@/components/forms/trip-payments";
import TripTracking from "@/components/forms/trip-tracking";
import StatusBadge from "@/components/status-badge";
import { getTripDetail } from "@/lib/queries";
import { isTripAdvanceClearedForTransit, listAdvanceRequests } from "@/lib/services/trip-advance.service";
import { getBalancePaymentTaskByTripId } from "@/lib/services/vendor-balance-payment.service";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/services/permission.service";
import { formatINR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const trip = await getTripDetail(params.id);
  if (!trip) notFound();
  const user = await getSessionUser();
  const canViewFinance =
    user?.role === "SUPER_ADMIN" ||
    (user?.id != null &&
      ((await hasPermission(user.id, "payment.view")) ||
        (await hasPermission(user.id, "invoice.view"))));
  const advanceRequests = await listAdvanceRequests({ tripId: params.id, source: "SHUNLINK" });
  const advanceClearedForTransit = await isTripAdvanceClearedForTransit(params.id);
  const balanceTask = await getBalancePaymentTaskByTripId(params.id, user);

  return (
    <div className="max-w-5xl">
      <Link href="/trips" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Trips
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{trip.lrNumber}</h1>
          <p className="text-slate-500">
            {trip.routeFrom} → {trip.routeTo}
            {trip.requirementNumber ? ` · ${trip.requirementNumber}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canViewFinance && (
            <Link
              href={`/finance/trips/${trip.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <IndianRupee className="h-4 w-4" /> Finance
            </Link>
          )}
          <StatusBadge status={trip.status} className="text-sm" />
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Trip Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TripStatusActions
            tripId={trip.id}
            status={trip.status}
            vendorAllocated={Boolean(trip.vendor)}
            advanceClearedForTransit={advanceClearedForTransit}
            podState={trip.podState}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-4">
            <div>
              <p className="text-slate-500">Created</p>
              <p className="font-medium">{formatDate(trip.createdAt)}</p>
            </div>
            <div>
              <p className="text-slate-500">Dispatched</p>
              <p className="font-medium">{formatDate(trip.dispatchedAt)}</p>
            </div>
            <div>
              <p className="text-slate-500">Delivered</p>
              <p className="font-medium">{formatDate(trip.deliveredAt)}</p>
            </div>
            <div>
              <p className="text-slate-500">POD Received</p>
              <p className="font-medium">{formatDate(trip.podReceivedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {balanceTask && (
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle>Vendor Balance Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-emerald-700">
                  {balanceTask.status === "PROCESSED"
                    ? `${formatINR(balanceTask.paidAmount)} paid`
                    : balanceTask.paidAmount > 0
                      ? `${formatINR(balanceTask.outstandingBalance)} due · ${formatINR(balanceTask.paidAmount)} paid`
                      : `${formatINR(balanceTask.balanceAmount)} due`}
                </p>
                <p className="text-slate-500">
                  Freight {formatINR(balanceTask.freightAmount)}
                  {balanceTask.additionalChargesAmount > 0
                    ? ` + Charges ${formatINR(balanceTask.additionalChargesAmount)}`
                    : ""}
                  {balanceTask.deductionsAmount > 0 ? ` − Deductions ${formatINR(balanceTask.deductionsAmount)}` : ""}
                  {balanceTask.tdsAmount > 0 ? ` − TDS ${formatINR(balanceTask.tdsAmount)}` : ""}
                  {` − Advance ${formatINR(balanceTask.advanceAmount)}`}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  POD verified {formatDate(balanceTask.podVerifiedAt)} · Due {formatDate(balanceTask.deadlineAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={balanceTask.slaBreached ? "SLA_BREACHED" : balanceTask.status} />
                <Link href="/balance-payments" className="text-blue-600 hover:underline text-xs">
                  Manage
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {advanceRequests.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Advance Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {advanceRequests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b last:border-0 py-2">
                <div>
                  <p className="font-medium">{r.requestNumber}</p>
                  <p className="text-slate-500">
                    Requested {formatINR(r.requestedAmount)}
                    {r.negotiatedAmount != null ? ` · Negotiated ${formatINR(r.negotiatedAmount)}` : ""}
                    {r.status === "PROCESSED" && r.paidAmount != null ? ` · Paid ${formatINR(r.paidAmount)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <Link href="/advance-payments" className="text-blue-600 hover:underline text-xs">
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium text-slate-900">{trip.client.name}</p>
            {trip.client.gstin && <p className="text-slate-600">GSTIN: {trip.client.gstin}</p>}
            {trip.client.phone && <p className="text-slate-600">{trip.client.phone}</p>}
            {trip.client.address && <p className="text-slate-500">{trip.client.address}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendor</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium text-slate-900">{trip.vendor.name}</p>
            <p className="text-slate-600">
              {trip.vendor.type === "FLEET_OWNER" ? "Fleet Owner" : "Broker"}
            </p>
            {trip.vendor.phone && <p className="text-slate-600">{trip.vendor.phone}</p>}
            {trip.vendor.bankAccount && (
              <p className="text-slate-500">
                {trip.vendor.bankName} · {trip.vendor.bankAccount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle & Driver</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium text-slate-900">{trip.vehicle.number}</p>
            <p className="text-slate-600">{trip.vehicle.type.replace(/_/g, " ")}</p>
            {trip.driver ? (
              <>
                <p className="text-slate-600 pt-1">{trip.driver.name}</p>
                <p className="text-slate-500">{trip.driver.phone}</p>
              </>
            ) : (
              <p className="text-slate-400">No driver assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Freight & Margin</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Client Rate</p>
              <p className="text-lg font-semibold text-slate-900">{formatINR(trip.clientRate)}</p>
            </div>
            <div>
              <p className="text-slate-500">Vendor Rate</p>
              <p className="text-lg font-semibold text-slate-900">{formatINR(trip.vendorRate)}</p>
            </div>
            <div>
              <p className="text-slate-500">Margin</p>
              <p className="text-lg font-semibold text-green-600">{formatINR(trip.margin)}</p>
            </div>
          </div>
          {trip.cargoDetails && (
            <p className="text-sm text-slate-600 mt-4">Cargo: {trip.cargoDetails}</p>
          )}
          {trip.invoice && (
            <p className="text-sm mt-3">
              Invoiced under{" "}
              <Link href={`/invoices/${trip.invoice.id}`} className="text-blue-600 hover:underline">
                {trip.invoice.invoiceNumber}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">Proof of Delivery</h3>
                <PodUpload tripId={trip.id} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">Other documents</h3>
                <DocumentUpload
                  tripId={trip.id}
                  documents={trip.documents.filter((d) => d.type !== "POD")}
                  allowedTypes={["LR", "EWAY_BILL", "DELIVERY_CHALLAN", "GATE_PASS", "INVOICE", "OTHER"]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <TripPayments payments={trip.payments} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Live Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <TripTracking tripId={trip.id} tripStatus={trip.status} pings={trip.pings} />
        </CardContent>
      </Card>
    </div>
  );
}
