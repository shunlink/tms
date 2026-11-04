"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

export default function InvoiceEinvoiceFields({
  invoiceId,
  initialIrn,
  initialAckNo,
  generatedAt,
  readOnly = false,
}: {
  invoiceId: string;
  initialIrn: string | null;
  initialAckNo: string | null;
  generatedAt: Date | string | null;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [irn, setIrn] = useState(initialIrn ?? "");
  const [ackNo, setAckNo] = useState(initialAckNo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eInvoice: {
            eInvoiceIrn: irn.trim() || null,
            eInvoiceAckNo: ackNo.trim() || null,
          },
        }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Could not save e-invoice details" });
        return;
      }
      toast.push({ variant: "success", title: "E-invoice details saved" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">E-invoice (IRN)</CardTitle>
        <p className="text-sm text-slate-500 font-normal">
          IRN and Ack Number from NIC e-invoice generation. Shown on the printed tax invoice. Leave blank until
          e-invoice is generated.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">IRN</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm font-mono"
              value={irn}
              onChange={(e) => setIrn(e.target.value)}
              placeholder="64-character IRN from portal"
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ack Number</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm font-mono"
              value={ackNo}
              onChange={(e) => setAckNo(e.target.value)}
              placeholder="Acknowledgement number"
              disabled={readOnly}
            />
          </div>
        </div>
        {generatedAt && (
          <p className="text-xs text-slate-500">
            Last recorded: {new Date(generatedAt).toLocaleString()}
          </p>
        )}
        {!readOnly && (
          <Button type="button" variant="outline" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save e-invoice details"}
          </Button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
