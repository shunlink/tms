"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

import { readJsonBody, resolveApiError } from "@/lib/api-client";
export default function BankStatementImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runPreview() {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("glAccountCode", "1010");
      const res = await fetch("/api/accounting/bank-statements/preview", { method: "POST", body: form });
      const data = await readJsonBody(res);
      if (!res.ok) throw new Error(resolveApiError(res, data, "Preview failed").message);
      setPreview(data as Record<string, unknown>);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function commitImport() {
    const importId = preview?.importId;
    if (!importId || typeof importId !== "string") return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/accounting/bank-statements/${importId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowDuplicateFile: Boolean(preview?.duplicateFile) }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) throw new Error(resolveApiError(res, data, "Commit failed").message);
      setMessage("Import committed.");
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 border rounded p-4">
      <p className="text-sm font-medium">Import bank statement (CSV)</p>
      <p className="text-xs text-slate-500">
        Default columns: Date, Value Date, Narration, Reference, Debit, Credit, Balance. Uploaded files are
        not treated as verified bank feeds.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!file || loading} onClick={runPreview}>
          Preview
        </Button>
        <Button size="sm" disabled={!preview || loading} onClick={commitImport}>
          Commit import
        </Button>
      </div>
      {preview && (
        <pre className="text-xs bg-slate-50 p-2 overflow-auto max-h-48">
          {JSON.stringify(
            {
              rowCount: preview.rowCount,
              errors: preview.errors,
              warnings: preview.warnings,
              duplicateFile: preview.duplicateFile,
            },
            null,
            2
          )}
        </pre>
      )}
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </div>
  );
}
