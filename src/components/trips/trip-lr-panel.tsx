"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import { formatDate } from "@/lib/utils";

export default function TripLrPanel({
  tripId,
  lrUrl,
  generatedAt,
  canRegenerate,
}: {
  tripId: string;
  lrUrl: string | null;
  generatedAt: Date | string | null;
  canRegenerate: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function regenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/lr/regenerate`, { method: "POST" });
      const body = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, body, { toast, fallback: "Could not regenerate LR" });
        return;
      }
      toast.push({ variant: "success", title: "Lorry receipt regenerated" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6 border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-slate-700" /> Lorry Receipt (LR)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {lrUrl ? (
          <>
            <p className="text-slate-600">
              System-generated consignment note (4 copies: Shipper, Consignee, Driver, Accounts).
              {generatedAt ? ` Generated ${formatDate(generatedAt)}.` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={lrUrl} target="_blank" rel="noreferrer">
                <Button
                  type="button"
                  size="sm"
                  className="bg-slate-900 text-white hover:bg-slate-800"
                >
                  View / Download PDF
                </Button>
              </a>
              {canRegenerate && (
                <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void regenerate()}>
                  {loading ? "Regenerating…" : "Regenerate from indent"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-slate-500">No LR PDF yet for this trip.</p>
            {canRegenerate && (
              <Button
                type="button"
                size="sm"
                disabled={loading}
                className="bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => void regenerate()}
              >
                {loading ? "Generating…" : "Generate LR PDF"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
