"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ProcessOutbox() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/notifications/process", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setMsg(`Processed ${d.processed} (${d.sent} sent, ${d.failed} failed) via ${d.provider}`);
      router.refresh();
    } else {
      setMsg("Failed to process outbox");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={busy}>
        {busy ? "Processing..." : "Process Outbox"}
      </Button>
      {msg && <span className="text-sm text-slate-600">{msg}</span>}
    </div>
  );
}
