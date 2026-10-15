"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { showApiError, showSuccess } from "@/lib/toast-utils";
import { Camera, CheckCircle2, Loader2, UploadCloud } from "lucide-react";

const MAX_SIZE = 10 * 1024 * 1024;

type Side = "front" | "back";

export default function PodUpload({
  tripId,
  alwaysCamera = false,
}: {
  tripId: string;
  alwaysCamera?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function onPick(side: Side, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.push({ title: "File too large (max 10 MB)", variant: "error" });
      return;
    }
    if (side === "front") setFrontFile(file);
    else setBackFile(file);
  }

  async function submit() {
    if (!frontFile || !backFile) {
      toast.push({
        title: "Both front and back POD images are required",
        variant: "warning",
      });
      return;
    }

    setBusy(true);
    const fd = new FormData();
    fd.append("type", "POD");
    fd.append("front", frontFile);
    fd.append("back", backFile);

    const res = await fetch(`/api/trips/${tripId}/documents`, { method: "POST", body: fd });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showApiError(toast, data, "POD upload failed");
      return;
    }

    showSuccess(toast, "POD uploaded", "Front and back images submitted for verification.");
    setFrontFile(null);
    setBackFile(null);
    if (frontRef.current) frontRef.current.value = "";
    if (backRef.current) backRef.current.value = "";
    router.refresh();
  }

  const inputClass = alwaysCamera ? "environment" : undefined;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Upload clear photos of both sides of the POD — front and back are required.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PodSidePicker
          label="Front of POD"
          file={frontFile}
          inputRef={frontRef}
          capture={inputClass}
          onChange={(e) => onPick("front", e)}
        />
        <PodSidePicker
          label="Back of POD"
          file={backFile}
          inputRef={backRef}
          capture={inputClass}
          onChange={(e) => onPick("back", e)}
        />
      </div>

      <Button type="button" className="w-full sm:w-auto" onClick={submit} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4 mr-2" /> Submit POD (front + back)
          </>
        )}
      </Button>
    </div>
  );
}

function PodSidePicker({
  label,
  file,
  inputRef,
  capture,
  onChange,
}: {
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  capture?: boolean | "user" | "environment";
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-2">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={onChange}
      />
      <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
        <Camera className="h-4 w-4 mr-2" />
        {file ? "Change photo" : "Choose photo"}
      </Button>
      {file && (
        <p className="text-xs text-green-700 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> {file.name}
        </p>
      )}
    </div>
  );
}
