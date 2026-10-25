"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import { formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type PodRecord = {
  id: string;
  tripId?: string | null;
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
  debitNoteGateSatisfied?: boolean;
  debitNoteDraftPath?: string | null;
  issuedDebitNoteNumber?: string | null;
  previousPod?: {
    id: string;
    url: string | null;
    backUrl?: string | null;
    status: string;
    rejectionReason: string | null;
    rejectedBy: string | null;
  } | null;
};

function ChargeModal({
  title,
  open,
  loading,
  onClose,
  onConfirm,
}: {
  title: string;
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (loadingCharge: number, unloadingCharge: number) => void;
}) {
  const [loadingCharge, setLoadingCharge] = useState("0");
  const [unloadingCharge, setUnloadingCharge] = useState("0");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4 space-y-3">
        <h3 className="font-medium text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">
          Client loading and unloading charges (₹) are added to the invoice for this trip.
        </p>
        <label className="text-sm block">
          <span className="text-slate-600">Loading charge (₹)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={loadingCharge}
            onChange={(e) => setLoadingCharge(e.target.value)}
          />
        </label>
        <label className="text-sm block">
          <span className="text-slate-600">Unloading charge (₹)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={unloadingCharge}
            onChange={(e) => setUnloadingCharge(e.target.value)}
          />
        </label>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={() =>
              onConfirm(Number(loadingCharge) || 0, Number(unloadingCharge) || 0)
            }
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PodVerificationPanel({
  pods,
  canVerify,
  canManage,
  indentId,
  vendorId,
}: {
  pods: PodRecord[];
  canVerify: boolean;
  canManage: boolean;
  indentId?: string;
  vendorId?: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reuploadId, setReuploadId] = useState<string | null>(null);
  const [chargeModal, setChargeModal] = useState<{
    podId: string;
    action: "verify" | "mark_good";
  } | null>(null);

  async function postReview(
    podId: string,
    action: "verify" | "reject" | "mark_good",
    extra?: Record<string, unknown>
  ) {
    setLoading(podId);
    try {
      const res = await fetch(`/api/pods/${podId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const errBody = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, errBody, { toast, fallback: "Action failed" });
        return;
      }
      setRejectingId(null);
      setRejectReason("");
      setChargeModal(null);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function reuploadPod(podId: string) {
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
      const errBody = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, errBody, { toast, fallback: "Upload failed" });
        return;
      }
      setReuploadId(null);
      if (frontRef.current) frontRef.current.value = "";
      if (backRef.current) backRef.current.value = "";
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function debitNotePath(pod: PodRecord) {
    if (pod.debitNoteDraftPath) return pod.debitNoteDraftPath;
    if (!pod.tripId || !indentId || !vendorId) return "/financial-notes/new";
    const q = new URLSearchParams({
      tripId: pod.tripId,
      indentPodId: pod.id,
      indentId,
      vendorId,
      purpose: "VENDOR_FREIGHT_REDUCTION",
      noteType: "DEBIT_NOTE",
    });
    return `/financial-notes/new?${q.toString()}`;
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

                {p.status === "PENDING_VERIFICATION" && (canVerify || canManage) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {canVerify && (
                      <Button
                        size="sm"
                        disabled={loading === p.id}
                        onClick={() => setChargeModal({ podId: p.id, action: "verify" })}
                      >
                        Verify
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading === p.id}
                          onClick={() => setRejectingId(rejectingId === p.id ? null : p.id)}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading === p.id}
                          onClick={() => setReuploadId(reuploadId === p.id ? null : p.id)}
                        >
                          Re-upload images
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {reuploadId === p.id && p.status === "PENDING_VERIFICATION" && (
                  <div className="flex flex-col gap-2 pt-1 border-t mt-2">
                    <p className="text-xs text-slate-500">
                      Replace front and back images before verify/reject. Does not resolve a bad POD.
                    </p>
                    <label className="text-xs text-slate-500">Front of POD</label>
                    <input ref={frontRef} type="file" accept="image/*" />
                    <label className="text-xs text-slate-500">Back of POD</label>
                    <input ref={backRef} type="file" accept="image/*" />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={loading === p.id} onClick={() => reuploadPod(p.id)}>
                        Save images
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setReuploadId(null)}>
                        Cancel
                      </Button>
                    </div>
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
                      onClick={() => postReview(p.id, "reject", { rejectionReason: rejectReason })}
                    >
                      Confirm Rejection
                    </Button>
                  </div>
                )}

                {p.status === "BAD_POD" &&
                  (p.resolutionStatus === "PENDING" || p.resolutionStatus === "SLA_BREACHED") &&
                  canVerify && (
                    <div className="pt-2 space-y-2 border-t">
                      <p className="text-xs text-slate-600">
                        Bad POD is resolved only after an issued vendor debit note, then mark as good
                        (with client loading/unloading charges).
                      </p>
                      {p.debitNoteGateSatisfied ? (
                        <p className="text-xs text-green-700">
                          Debit note issued
                          {p.issuedDebitNoteNumber ? ` (${p.issuedDebitNoteNumber})` : ""}.
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700">Vendor debit note not issued yet.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Link href={debitNotePath(p)}>
                          <Button size="sm" variant="outline" type="button">
                            Create vendor debit note
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          disabled={loading === p.id || !p.debitNoteGateSatisfied}
                          onClick={() => setChargeModal({ podId: p.id, action: "mark_good" })}
                        >
                          Mark as Good POD
                        </Button>
                      </div>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ChargeModal
        title={
          chargeModal?.action === "mark_good"
            ? "Mark as Good POD — client charges"
            : "Verify POD — client charges"
        }
        open={Boolean(chargeModal)}
        loading={Boolean(chargeModal && loading === chargeModal.podId)}
        onClose={() => setChargeModal(null)}
        onConfirm={(loadingCharge, unloadingCharge) => {
          if (!chargeModal) return;
          postReview(chargeModal.podId, chargeModal.action, {
            loadingCharge,
            unloadingCharge,
          });
        }}
      />
    </Card>
  );
}
