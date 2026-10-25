"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Camera, UploadCloud, CheckCircle2, Loader2 } from "lucide-react";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  if (/Android|iPhone|iPad|iPod|webOS|Windows Phone/i.test(navigator.userAgent)) return true;
  return (
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    navigator.maxTouchPoints > 0
  );
}

export default function CameraCapture({
  tripId,
  docType = "POD",
  alwaysCamera = false,
}: {
  tripId: string;
  docType?: string;
  alwaysCamera?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [captureUrl, setCaptureUrl] = useState("");
  const [mobile, setMobile] = useState(alwaysCamera);

  useEffect(() => {
    if (!alwaysCamera) setMobile(isMobileDevice());
    setCaptureUrl(
      `${window.location.origin}/capture?tripId=${encodeURIComponent(tripId)}&type=${encodeURIComponent(docType)}`
    );
  }, [tripId, docType, alwaysCamera]);

  async function uploadFile(file: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setOk(false);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", docType);
    const res = await fetch(`/api/trips/${tripId}/documents`, {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Upload failed" });
      return;
    }
    setOk(true);
    router.refresh();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (mobile) {
    return (
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
        <Button
          type="button"
          className="w-full h-14 text-base"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" /> Capture {docType.replace(/_/g, " ")}
            </>
          )}
        </Button>
        <p className="text-xs text-slate-500 text-center">
          Opens your camera so you can take a photo of the {docType.replace(/_/g, " ")}.
        </p>
        {ok && (
          <p className="text-sm text-green-600 flex items-center justify-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Uploaded successfully.
          </p>
        )}
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="shrink-0">
          {captureUrl && (
            <div className="rounded-lg border p-2 bg-white">
              <QRCodeSVG value={captureUrl} size={160} marginSize={2} />
            </div>
          )}
        </div>
        <div className="text-sm text-slate-600 space-y-1">
          <p className="font-medium text-slate-900">Capture on your phone</p>
          <p>
            Scan this QR code with your phone camera. It opens the capture page
            where you can photograph the {docType.replace(/_/g, " ")}.
          </p>
          <p className="text-xs text-slate-400">
            You&apos;ll need to be signed in on your phone.
          </p>
        </div>
      </div>

      <div className="border-t pt-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          <UploadCloud className="h-4 w-4 mr-2" />
          {busy ? "Uploading…" : "Or choose a photo from this device"}
        </Button>
      </div>

      {ok && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4" /> Uploaded successfully.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
