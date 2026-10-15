"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Doc = { id: string; type: string; url: string; name: string | null; createdAt: string };

const DOC_TYPES: [string, string][] = [
  ["LR", "LR (Lorry Receipt)"],
  ["EWAY_BILL", "E-way Bill"],
  ["POD", "POD (Proof of Delivery)"],
  ["DELIVERY_CHALLAN", "Delivery Challan"],
  ["GATE_PASS", "Gate Pass"],
  ["INVOICE", "Invoice"],
  ["OTHER", "Other"],
];

export default function DocumentUpload({
  tripId,
  documents,
  allowedTypes,
  allowDelete = true,
}: {
  tripId: string;
  documents: Doc[];
  allowedTypes?: string[];
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const types = allowedTypes
    ? DOC_TYPES.filter(([v]) => allowedTypes.includes(v))
    : DOC_TYPES;
  const [type, setType] = useState(types[0]?.[0] ?? "LR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload");
      return;
    }
    setError("");
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    const res = await fetch(`/api/trips/${tripId}/documents`, {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Upload failed");
      return;
    }
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={upload} className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-white"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {types.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">File (max 10 MB)</label>
          <input ref={fileRef} type="file" className="text-sm" />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Uploading..." : "Upload"}
        </Button>
      </form>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="space-y-2">
        {documents.length === 0 && (
          <p className="text-sm text-slate-400">No documents uploaded yet.</p>
        )}
        {documents.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between border rounded-md px-3 py-2"
          >
            <div className="min-w-0">
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 mr-2">
                {d.type.replace(/_/g, " ")}
              </span>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {d.name ?? d.url}
              </a>
            </div>
            {allowDelete && (
              <button
                onClick={() => remove(d.id)}
                disabled={busy}
                className="text-sm text-red-600 hover:underline disabled:opacity-50 shrink-0"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
