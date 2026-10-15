"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NotificationActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markSent() {
    setBusy(true);
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SENT" }),
    });
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds: [id] }),
    });
    setBusy(false);
    router.refresh();
    window.dispatchEvent(new Event("sidebar-counts-refresh"));
  }

  if (status === "SENT") return <span className="text-xs text-green-600">Sent</span>;

  return (
    <button
      onClick={markSent}
      disabled={busy}
      className="text-sm text-blue-600 hover:underline disabled:opacity-50"
    >
      {busy ? "..." : "Mark Sent"}
    </button>
  );
}
