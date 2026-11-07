"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, FileUp, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import {
  INDENT_DOCUMENT_TYPES,
  indentDocumentProgress,
} from "@/lib/indent-documents";

export type IndentDoc = {
  id: string;
  type: string;
  url: string;
  name: string | null;
  createdAt?: string;
};

export default function IndentDocumentsModal({
  open,
  onClose,
  indentId,
  documents,
  readOnly = false,
  onDocumentsChange,
}: {
  open: boolean;
  onClose: () => void;
  indentId: string;
  documents: IndentDoc[];
  readOnly?: boolean;
  onDocumentsChange?: (documents: IndentDoc[]) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [localDocs, setLocalDocs] = useState<IndentDoc[]>(documents);

  useEffect(() => {
    if (open) {
      setLocalDocs(documents);
      setError("");
    }
  }, [open, documents]);

  const byType = new Map<string, IndentDoc>();
  for (const d of localDocs) {
    if (!byType.has(d.type)) byType.set(d.type, d);
  }
  const progress = indentDocumentProgress(localDocs);

  function syncDocs(next: IndentDoc[]) {
    setLocalDocs(next);
    onDocumentsChange?.(next);
  }

  async function upload(type: string, file: File, replaceId?: string) {
    setError("");
    setBusyType(type);
    try {
      if (replaceId) {
        const delRes = await fetch(`/api/documents/${replaceId}`, { method: "DELETE" });
        if (!delRes.ok) {
          const delData = await readJsonBody(delRes);
          reportApiFailure(delRes, delData, { toast, setError, fallback: "Could not replace file" });
          return;
        }
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      fd.append("ownerType", "indent");
      fd.append("ownerId", indentId);

      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Upload failed" });
        return;
      }

      const uploaded = data as IndentDoc | null;
      if (!uploaded?.id) {
        setError("Upload succeeded but response was incomplete");
        return;
      }

      const next = [
        ...localDocs.filter((d) => d.type !== type && d.id !== replaceId),
        {
          id: String(uploaded.id),
          type,
          url: String(uploaded.url ?? ""),
          name: uploaded.name != null ? String(uploaded.name) : file.name,
          createdAt: uploaded.createdAt,
        },
      ];
      syncDocs(next);
      toast.push({ title: "Document uploaded", variant: "success" });
      router.refresh();
    } finally {
      setBusyType(null);
    }
  }

  async function remove(id: string, type: string) {
    setError("");
    setBusyType(type);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await readJsonBody(res);
        reportApiFailure(res, data, { toast, setError, fallback: "Delete failed" });
        return;
      }
      syncDocs(localDocs.filter((d) => d.id !== id));
      toast.push({ title: "Document removed", variant: "success" });
      router.refresh();
    } finally {
      setBusyType(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="indent-docs-modal-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="indent-docs-modal-title" className="text-lg font-semibold text-slate-900">
              File Uploads
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {progress.requiredUploaded} of {progress.requiredTotal} required uploaded
              {progress.optionalUploaded > 0
                ? ` · ${progress.optionalUploaded} optional`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Document</th>
                  <th className="px-3 py-2.5 font-medium">Requirement</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">File</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {INDENT_DOCUMENT_TYPES.map((cfg) => {
                  const file = byType.get(cfg.type);
                  const isBusy = busyType === cfg.type;
                  return (
                    <tr key={cfg.type} className="bg-white">
                      <td className="px-3 py-3 font-medium text-slate-900">{cfg.label}</td>
                      <td className="px-3 py-3">
                        {cfg.required ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                            Required
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Optional
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {file ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
                          </span>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {file ? (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[180px] items-center gap-1 truncate text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            {file.name ?? "View file"}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            ref={(el) => {
                              fileRefs.current[cfg.type] = el;
                            }}
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={(e) => {
                              const selected = e.target.files?.[0];
                              if (selected) upload(cfg.type, selected, file?.id);
                              e.target.value = "";
                            }}
                          />
                          {!readOnly && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => fileRefs.current[cfg.type]?.click()}
                            >
                              <Upload className="mr-1.5 h-3.5 w-3.5" />
                              {isBusy ? "Working..." : file ? "Replace" : "Upload"}
                            </Button>
                          )}
                          {!readOnly && file && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => remove(file.id, cfg.type)}
                              aria-label={`Delete ${cfg.label}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-xs text-slate-500">
            Uploading a file keeps this window open. Click Close when you are done.
          </p>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Compact trigger used on indent form / detail — opens the modal. */
export function IndentFileUploadsTrigger({
  indentId,
  documents,
  disabled = false,
  disabledHint = "Save the indent first to upload documents",
  readOnly = false,
}: {
  indentId?: string;
  documents?: IndentDoc[];
  disabled?: boolean;
  disabledHint?: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<IndentDoc[]>(documents ?? []);
  const progress = indentDocumentProgress(docs);
  const canOpen = Boolean(indentId) && !disabled;

  useEffect(() => {
    setDocs(documents ?? []);
  }, [documents]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">
            {canOpen
              ? `${progress.requiredUploaded}/${progress.requiredTotal} required · ${progress.optionalUploaded}/${progress.optionalTotal} optional`
              : disabledHint}
          </p>
          {canOpen && progress.missingRequired.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Missing: {progress.missingRequired.slice(0, 3).join(", ")}
              {progress.missingRequired.length > 3
                ? ` +${progress.missingRequired.length - 3} more`
                : ""}
            </p>
          )}
        </div>
        <Button type="button" variant="outline" disabled={!canOpen} onClick={() => setOpen(true)}>
          <FileUp className="mr-2 h-4 w-4" />
          File Uploads
        </Button>
      </div>

      {indentId && (
        <IndentDocumentsModal
          open={open}
          onClose={() => setOpen(false)}
          indentId={indentId}
          documents={docs}
          readOnly={readOnly}
          onDocumentsChange={setDocs}
        />
      )}
    </>
  );
}
