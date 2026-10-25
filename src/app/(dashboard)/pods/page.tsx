import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import { formatDate } from "@/lib/utils";
import {
  listPendingVerificationPods,
  listBadPodTasks,
  getVendorDebitNoteGateStatus,
} from "@/lib/services/pod.service";

export const dynamic = "force-dynamic";

export default async function PodsPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const view = searchParams.view ?? "pending";
  const [pending, bad] = await Promise.all([
    listPendingVerificationPods(),
    listBadPodTasks(),
  ]);

  const rows = view === "bad" ? bad : pending;

  const badGateByPodId = new Map(
    await Promise.all(
      bad.map(async (pod) => {
        const gate = pod.tripId
          ? await getVendorDebitNoteGateStatus(pod.tripId, pod.id)
          : { satisfied: false, note: null };
        return [pod.id, gate] as const;
      })
    )
  );

  return (
    <div>
      <PageHeader
        title="POD Queue"
        description="Finance queue — verify, reject, and resolve proof of delivery uploads (front + back required)"
      />

      <div className="flex gap-2 mb-6">
        <Link
          href="/pods?view=pending"
          className={`px-4 py-2 rounded-md text-sm font-medium ${view === "pending" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          Pending Verification ({pending.length})
        </Link>
        <Link
          href="/pods?view=bad"
          className={`px-4 py-2 rounded-md text-sm font-medium ${view === "bad" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          Bad POD ({bad.length})
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{view === "bad" ? "Bad POD Tasks" : "Pending Verification"}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">No PODs in this queue.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((pod) => (
                <div key={pod.id} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={pod.status} />
                      {pod.resolutionStatus && <StatusBadge status={pod.resolutionStatus} />}
                    </div>
                    <p className="font-medium text-sm mt-1">
                      {pod.indent?.indentNumber ?? "—"} · {pod.trip?.lrNumber ?? "No trip"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Uploaded {formatDate(pod.uploadedAt)} by {pod.source}
                      {pod.rejectionReason ? ` · ${pod.rejectionReason}` : ""}
                    </p>
                    {pod.slaDeadlineAt && pod.status === "BAD_POD" && (
                      <p className="text-xs text-amber-600">SLA due {formatDate(pod.slaDeadlineAt)}</p>
                    )}
                    {pod.status === "BAD_POD" && pod.tripId && (
                      <p className="text-xs mt-1">
                        {badGateByPodId.get(pod.id)?.satisfied
                          ? "Debit note issued — mark as good on review"
                          : "Issue vendor debit note before mark as good"}
                      </p>
                    )}
                  </div>
                  {pod.indent && (
                    <Link
                      href={`/indents/${pod.indent.id}?section=pod`}
                      className="text-sm text-blue-600 hover:underline shrink-0"
                    >
                      Review →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
