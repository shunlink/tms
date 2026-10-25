import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ConvertRequirementButton from "@/components/forms/convert-requirement-button";
import StatusBadge from "@/components/status-badge";
import { getRequirementDetail, matchVendorsForRequirement } from "@/lib/queries";
import { formatINR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RequirementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const req = await getRequirementDetail(params.id);
  if (!req) notFound();

  const matches = await matchVendorsForRequirement(params.id);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <Link href="/requirements" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Requirements
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{req.reqNumber}</h1>
          <p className="text-slate-500">
            {req.routeFrom} → {req.routeTo} · {req.client.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={req.status} className="text-sm" />
          <ConvertRequirementButton
            requirementId={req.id}
            indentId={req.indentId}
            status={req.status}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-500">Vehicle Type</p>
            <p className="font-medium text-slate-900">{req.vehicleType.replace(/_/g, " ")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-500">Allocated</p>
            <p className="font-medium text-slate-900">{req.allocated}/{req.quantity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-500">Expected Date</p>
            <p className="font-medium text-slate-900">{formatDate(req.expectedDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-500">Client Rate</p>
            <p className="font-medium text-slate-900">{req.clientRate ? formatINR(req.clientRate) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {req.cargoDetails && (
        <p className="text-sm text-slate-600 mb-6">Cargo: {req.cargoDetails}</p>
      )}

      {req.trips.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Allocated Trips ({req.trips.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-3 font-medium">LR No.</th>
                  <th className="pb-3 font-medium">Vendor</th>
                  <th className="pb-3 font-medium">Vehicle</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {req.trips.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-3 font-medium text-blue-600">
                      <Link href={`/trips/${t.id}`} className="hover:underline">{t.lrNumber}</Link>
                    </td>
                    <td className="py-3 text-slate-600">{t.vendor}</td>
                    <td className="py-3 text-slate-600">{t.vehicle}</td>
                    <td className="py-3">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" /> Suggested Vendors (auto-matched)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {matches.length === 0 && (
              <p className="text-sm text-slate-400">No available vehicles found.</p>
            )}
            {matches.map((m, i) => (
              <div
                key={m.vehicleId}
                className="flex items-start justify-between border rounded-md p-3 hover:bg-slate-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{m.vendorName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {m.vendorType === "FLEET_OWNER" ? "Fleet Owner" : "Broker"}
                    </span>
                    {i === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Best match
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {m.vehicleNumber} · {m.vehicleType.replace(/_/g, " ")}
                    {m.capacity ? ` · ${m.capacity}` : ""}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {m.reasons.join(" · ")} · score {m.score}
                  </p>
                </div>
                <span className="text-xs text-slate-400">Reference match</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
