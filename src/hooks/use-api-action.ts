"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/toast";
import { reportApiFailure, type ResolvedApiError } from "@/lib/api-client";

type RunOptions = {
  fallback?: string;
  silent?: boolean;
  onSuccess?: () => void;
};

/**
 * Wrap async API work with busy/error state and automatic toast on failure.
 * Pass a function that returns false or a failed Response handling internally.
 */
export function useApiAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const clearError = useCallback(() => setError(""), []);

  const run = useCallback(
    async (
      fn: () => Promise<boolean | void>,
      opts?: RunOptions
    ): Promise<boolean> => {
      setError("");
      setBusy(true);
      try {
        const result = await fn();
        if (result === false) {
          return false;
        }
        opts?.onSuccess?.();
        return true;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const fail = useCallback(
    (res: Response, body: unknown, opts?: RunOptions): ResolvedApiError => {
      return reportApiFailure(res, body, {
        toast,
        setError,
        fallback: opts?.fallback,
        silent: opts?.silent,
      });
    },
    [toast]
  );

  return { run, fail, busy, error, setError, clearError, toast };
}
