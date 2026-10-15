"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type PeriodRow = { id: string; name: string; status: string };

export default function AccountingPeriodActions({ periods }: { periods: PeriodRow[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function validatePeriod(id: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/accounting/periods/${id}/validate`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Validation failed");
      setMessage(
        `Validation: ${data.errorCount} error(s), ${data.warningCount} warning(s). canClose=${data.canClose}`
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  async function reviewPeriod(id: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/accounting/periods/${id}/review`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      setMessage("Period marked under review (posting blocked).");
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Review failed");
    } finally {
      setLoading(false);
    }
  }

  async function closePeriod(id: string) {
    setLoading(true);
    setMessage(null);
    try {
      const allowWarnings = window.confirm(
        "Allow close with validation warnings? (Requires documented exceptions in production.)"
      );
      const res = await fetch(`/api/accounting/periods/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowWarnings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Close failed");
      setMessage("Period closed.");
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Close failed");
    } finally {
      setLoading(false);
    }
  }

  async function reopenPeriod(id: string) {
    const reason = window.prompt("Reason for reopening (required):");
    if (!reason?.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/accounting/periods/${id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reopen failed");
      setMessage("Period reopened.");
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Reopen failed");
    } finally {
      setLoading(false);
    }
  }

  if (periods.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      <p className="text-sm font-medium text-slate-700">Authorized actions</p>
      <ul className="space-y-2">
        {periods.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm border rounded p-2">
            <span>{p.name} ({p.status})</span>
            <span className="space-x-2">
              {p.status === "OPEN" && (
                <>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => validatePeriod(p.id)}>
                    Validate
                  </Button>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => reviewPeriod(p.id)}>
                    Under review
                  </Button>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => closePeriod(p.id)}>
                    Close
                  </Button>
                </>
              )}
              {p.status === "UNDER_REVIEW" && (
                <>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => validatePeriod(p.id)}>
                    Validate
                  </Button>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => closePeriod(p.id)}>
                    Close
                  </Button>
                </>
              )}
              {p.status === "CLOSED" && (
                <Button size="sm" variant="outline" disabled={loading} onClick={() => reopenPeriod(p.id)}>
                  Reopen
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </div>
  );
}
