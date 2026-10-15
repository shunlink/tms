"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function GatewaySettlementImportForm({ disabled }: { disabled?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function upload() {
    if (!file || disabled) return;
    setLoading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/accounting/gateway-settlements/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setMessage(`Imported ${data.lineCount} settlement line(s).`);
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 border rounded p-4">
      <p className="text-sm font-medium">Import provider settlement CSV</p>
      <p className="text-xs text-slate-500">Expected header includes transfer_ref, amount, fee, net.</p>
      <input
        type="file"
        accept=".csv,text/csv"
        disabled={disabled}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <Button size="sm" disabled={!file || loading || disabled} onClick={upload}>
        Import
      </Button>
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </div>
  );
}
