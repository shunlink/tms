"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { SidebarCountsResponse } from "@/lib/services/sidebar-pending-counts.service";

const REFRESH_EVENT = "sidebar-counts-refresh";
const COUNTS_ENDPOINT = "/api/sidebar/pending-counts";

// Badges reflect backend work queues, so any successful write to our API can change them.
// Hooking fetch once covers every form without each one having to remember to dispatch.
function installMutationListener() {
  const w = window as unknown as { __tmsMutationListener?: boolean };
  if (w.__tmsMutationListener) return;
  w.__tmsMutationListener = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await originalFetch(input, init);
    try {
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method !== "GET" && method !== "HEAD" && res.ok) {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, window.location.origin);
        if (url.origin === window.location.origin && url.pathname.startsWith("/api/") && url.pathname !== COUNTS_ENDPOINT) {
          window.dispatchEvent(new Event(REFRESH_EVENT));
        }
      }
    } catch {
      /* never break the caller */
    }
    return res;
  };
}

export function useSidebarPendingCounts() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<SidebarCountsResponse>({});
  const [loaded, setLoaded] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(COUNTS_ENDPOINT, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as SidebarCountsResponse;
      setCounts(data ?? {});
      setLoaded(true);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    installMutationListener();
    const handler = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => refresh(), 400);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") handler();
    };
    window.addEventListener(REFRESH_EVENT, handler);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(REFRESH_EVENT, handler);
      document.removeEventListener("visibilitychange", onVisible);
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [refresh]);

  return { counts, loaded, refresh };
}
