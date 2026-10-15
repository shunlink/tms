"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import { formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";

type PodRecord = {
  id: string;
  url: string | null;
  backUrl?: string | null;
  source: string;
  status: string;
  remarks: string | null;
  uploadedAt: Date | string;
  uploadedBy: string | null;
  verifiedAt?: Date | string | null;
  verifiedBy?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: Date | string | null;
  rejectedBy?: string | null;
  resolutionStatus?: string | null;
  slaDeadlineAt?: Date | string | null;
  slaBreachedAt?: Date | string | null;
  previousPodId?: string | null;
  previousPod?: {
    id: string;
    url: string | null;
    backUrl?: string | null;
    status: string;
    rejectionReason: string | null;
    rejectedBy: string | null;
  } | null;
};

export default function PodVerificationPanel({
  pods,
  canVerify,
  canManage,
}: {
  pods: PodRecord[];
  canVerify: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [correctingId, setCorrectingId] = useState<string | null>(null);

  async function reviewPod(podId: string, action: "verify" | "reject") {
    setLoading(podId);
    try {
      const body =
        action === "reject"
          ? { action, rejectionReason: rejectReason }
          : { action };
      const res = await fetch(`/api/pods/${podId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Action failed");
        return;
      }
      setRejectingId(null);
      setRejectReason("");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function correctPod(podId: string) {
    const front = frontRef.current?.files?.[0];
    const back = backRef.current?.files?.[0];
    if (!front || !back) {
      alert("Both front and back POD images are required");
      return;
    }
    setLoading(podId);
    try {
      const form = new FormData();
      form.append("front", front);
      form.append("back", back);
      const res = await fetch(`/api/pods/${podId}/correct`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Upload failed");
        return;
      }
      setCorrectingId(null);
      if (frontRef.current) frontRef.current.value = "";
      if (backRef.current) backRef.current.value = "";
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-purple-600" /> POD Verification
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pods.length === 0 ? (
          <p className="text-sm text-slate-500">No POD uploaded yet.</p>
        ) : (
          <div className="space-y-4">
            {pods.map((p) => (
              <div key={p.id} className="rounded-lg border px-4 py-3 text-sm space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.source}</span>
                    <StatusBadge status={p.status} />
                    {p.resolutionStatus && <StatusBadge status={p.resolutionStatus} />}
                  </div>
                  <span className="text-xs text-slate-500">{formatDate(p.uploadedAt)}</span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  {p.uploadedBy && <p>Uploaded by {p.uploadedBy}</p>}
                  {p.verifiedBy && <p>Verified by {p.verifiedBy} · {formatDate(p.verifiedAt!)}</p>}
                  {p.rejectedBy && (
                    <p>
                      Rejected by {p.rejectedBy} · {formatDate(p.rejectedAt!)}
                      {p.rejectionReason && ` — ${p.rejectionReason}`}
                    </p>
                  )}
                  {p.slaDeadlineAt && p.status === "BAD_POD" && (
                    <p>SLA deadline: {formatDate(p.slaDeadlineAt)}</p>
                  )}
                  {p.previousPod && (
                    <p className="text-amber-700">
                      Corrects rejected POD ({p.previousPod.rejectionReason ?? "—"})
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {p.url && (
                    <a href={p.url} className="text-blue-600 hover:underline text-xs" target="_blank">
                      View front
                    </a>
                  )}
                  {p.backUrl && (
                    <a href={p.backUrl} className="text-blue-600 hover:underline text-xs" target="_blank">
                      View back
                    </a>
                  )}
                </div>

                {p.status === "PENDING_VERIFICATION" && canVerify && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={loading === p.id}
                      onClick={() => reviewPod(p.id, "verify")}
                    >
                      Verify
                    </Button>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading === p.id}
                        onClick={() => setRejectingId(rejectingId === p.id ? null : p.id)}
                      >
                        Reject
                      </Button>
                    )}
                  </div>
                )}

                {rejectingId === p.id && (
                  <div className="flex flex-col gap-2 pt-1">
                    <textarea
                      className="w-full rounded border px-2 py-1 text-sm"
                      placeholder="Rejection reason (required)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!rejectReason.trim() || loading === p.id}
                      onClick={() => reviewPod(p.id, "reject")}
                    >
                      Confirm Rejection
                    </Button>
                  </div>
                )}

                {p.status === "BAD_POD" &&
                  (p.resolutionStatus === "PENDING" || p.resolutionStatus === "SLA_BREACHED") &&
                  canManage && (
                    <div className="pt-1 space-y-2">
                      {correctingId !== p.id ? (
                        <Button size="sm" variant="outline" onClick={() => setCorrectingId(p.id)}>
                          Upload Corrected POD
                        </Button>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <label className="text-xs text-slate-500">Front of POD</label>
                          <input ref={frontRef} type="file" accept="image/*" />
                          <label className="text-xs text-slate-500">Back of POD</label>
                          <input ref={backRef} type="file" accept="image/*" />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={loading === p.id}
                              onClick={() => correctPod(p.id)}
                            >
                              Submit for Verification
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setCorrectingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
