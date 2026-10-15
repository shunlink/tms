"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function PortalAccessBanner() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const portalAccess = session?.portalAccess;
  if (!portalAccess?.targetEmail) return null;

  async function endAccess() {
    setLoading(true);
    try {
      await fetch("/api/superadmin/portal-access/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: portalAccess?.sessionId }),
      });
      await update({ clearPortalAccess: true });
      router.push("/superadmin/portal-access");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex flex-wrap items-center justify-between gap-3 print:hidden"
      role="status"
    >
      <span className="font-medium">
        Superadmin access — viewing as {portalAccess.targetEmail}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="bg-amber-100 hover:bg-white text-amber-950"
        disabled={loading}
        onClick={() => endAccess()}
      >
        {loading ? "Ending…" : "End portal access"}
      </Button>
    </div>
  );
}
