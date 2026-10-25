"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { readJsonBody, resolveApiError } from "@/lib/api-client";
type Props = {
  noteId: string;
  status: string;
};

async function postAction(path: string, body?: object): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await readJsonBody(res);
  if (!res.ok) throw new Error(resolveApiError(res, data, "Request failed").message);
}

export default function FinancialNoteActions({ noteId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  };

  const base = `/api/financial-notes/${noteId}`;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {error && <p className="text-sm text-red-600 w-full">{error}</p>}
      {(status === "DRAFT" || status === "REJECTED") && (
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => run("submit", () => postAction(`${base}/submit`))}
        >
          Submit for approval
        </Button>
      )}
      {status === "PENDING_APPROVAL" && (
        <>
          <Button
            size="sm"
            disabled={!!loading}
            onClick={() => run("approve", () => postAction(`${base}/approve`))}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!!loading}
            onClick={() => {
              const reason = window.prompt("Rejection reason");
              if (!reason) return;
              run("reject", () => postAction(`${base}/reject`, { reason }));
            }}
          >
            Reject
          </Button>
        </>
      )}
      {(status === "APPROVED" || status === "DRAFT") && (
        <Button
          size="sm"
          disabled={!!loading}
          onClick={() => run("issue", () => postAction(`${base}/issue`))}
        >
          Issue
        </Button>
      )}
      {status === "ISSUED" && (
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => {
            const reason = window.prompt("Reversal reason");
            if (!reason) return;
            run("reverse", () => postAction(`${base}/reverse`, { reason }));
          }}
        >
          Reverse
        </Button>
      )}
      {(status === "DRAFT" || status === "PENDING_APPROVAL" || status === "APPROVED") && (
        <Button
          size="sm"
          variant="ghost"
          disabled={!!loading}
          onClick={() => {
            const reason = window.prompt("Void reason");
            if (!reason) return;
            run("void", () => postAction(`${base}/void`, { reason }));
          }}
        >
          Void draft
        </Button>
      )}
    </div>
  );
}
