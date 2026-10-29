"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readJsonBody } from "@/lib/api-client";
import { formatBiddingProxyError } from "@/lib/bidding/admin-api";
import {
  type AuctionBidRow,
  auctionPusherChannelName,
  extractBidFromPusherPayload,
  normalizeAuctionBid,
  deriveStandingFromEvents,
  latestAuctionEventId,
  mergeAuctionEventRows,
  type AuctionBidsApiMeta,
  parseAuctionBidsResponse,
} from "@/lib/bidding/auction-bids";

type PusherChannel = {
  bind: (event: string, callback: (data: unknown) => void) => void;
  unbind: (event?: string, callback?: (data: unknown) => void) => void;
};

type PusherConnection = {
  bind: (event: string, callback: () => void) => void;
  unbind: (event: string, callback: () => void) => void;
};

type PusherClient = {
  subscribe: (channelName: string) => PusherChannel;
  unsubscribe: (channelName: string) => void;
  disconnect: () => void;
  connection: PusherConnection;
};

type PusherConstructor = new (
  key: string,
  options: { cluster: string; forceTLS?: boolean }
) => PusherClient;

declare global {
  interface Window {
    Pusher?: PusherConstructor;
  }
}

const PUSHER_SCRIPT_SRC = "https://js.pusher.com/8.4.0/pusher.min.js";
let pusherScriptLoad: Promise<void> | null = null;

function loadPusherScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Pusher) return Promise.resolve();
  if (!pusherScriptLoad) {
    pusherScriptLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PUSHER_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Pusher client"));
      document.head.appendChild(script);
    });
  }
  return pusherScriptLoad;
}

type UseAuctionBidFeedOptions = {
  auctionId: string;
  enabled: boolean;
  live: boolean;
  pollIntervalMs?: number;
};

export function useAuctionBidFeed({
  auctionId,
  enabled,
  live,
  pollIntervalMs = 5000,
}: UseAuctionBidFeedOptions) {
  const [events, setEvents] = useState<AuctionBidRow[]>([]);
  const [standing, setStanding] = useState<AuctionBidRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);
  const [bidsMeta, setBidsMeta] = useState<AuctionBidsApiMeta>({});
  const pusherRef = useRef<PusherClient | null>(null);
  const channelNameRef = useRef<string | null>(null);
  const priceDropHandlerRef = useRef<((data: unknown) => void) | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const effectiveLive = live || bidsMeta.requirementStatus === "AUCTION_LIVE";

  const loadHistory = useCallback(
    async (mode: "full" | "incremental" = "full") => {
      if (!enabled || !auctionId?.trim()) {
        setEvents([]);
        setStanding([]);
        setBidsMeta({});
        setError("");
        lastEventIdRef.current = null;
        return;
      }

      const incremental =
        mode === "incremental" && lastEventIdRef.current?.trim();
      const query = incremental
        ? `?afterEventId=${encodeURIComponent(lastEventIdRef.current!)}`
        : "";

      if (!incremental) {
        setLoading(true);
      }
      setError("");
      try {
        const res = await fetch(
          `/api/bidding-proxy/admin/auctions/${encodeURIComponent(auctionId)}/bids${query}`
        );
        const data = await readJsonBody(res);
        if (!res.ok) {
          if (!incremental) {
            setEvents([]);
            setStanding([]);
            setBidsMeta({});
          }
          setError(formatBiddingProxyError(res.status, data, "Could not load bid history"));
          return;
        }
        const parsed = parseAuctionBidsResponse(data);
        if (incremental && parsed.events.length > 0) {
          setEvents((prev) => {
            const merged = mergeAuctionEventRows(prev, parsed.events);
            const nextId = latestAuctionEventId(merged);
            if (nextId) lastEventIdRef.current = nextId;
            return merged;
          });
        } else if (!incremental) {
          setEvents(parsed.events);
          const nextId = latestAuctionEventId(parsed.events);
          if (nextId) lastEventIdRef.current = nextId;
        }
        setStanding(parsed.standing);
        setBidsMeta(parsed.meta);
      } catch {
        if (!incremental) {
          setEvents([]);
          setStanding([]);
          setError("Network error while loading bids");
        }
      } finally {
        if (!incremental) {
          setLoading(false);
        }
      }
    },
    [auctionId, enabled]
  );

  const loadHistoryFull = useCallback(() => loadHistory("full"), [loadHistory]);
  const loadHistoryIncremental = useCallback(
    () => loadHistory("incremental"),
    [loadHistory]
  );

  useEffect(() => {
    lastEventIdRef.current = null;
    void loadHistoryFull();
  }, [auctionId, enabled, loadHistoryFull]);

  useEffect(() => {
    if (!enabled || !effectiveLive || !auctionId?.trim()) return;
    const id = window.setInterval(() => {
      void loadHistoryIncremental();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [enabled, effectiveLive, auctionId, pollIntervalMs, loadHistoryIncremental]);

  useEffect(() => {
    if (!enabled || !effectiveLive) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadHistoryFull();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, effectiveLive, loadHistoryFull]);

  useEffect(() => {
    if (!enabled || !effectiveLive || !auctionId?.trim()) {
      setLiveConnected(false);
      return;
    }

    const key = process.env.NEXT_PUBLIC_BIDDING_PUSHER_KEY?.trim();
    const cluster = process.env.NEXT_PUBLIC_BIDDING_PUSHER_CLUSTER?.trim() || "ap2";
    if (!key) {
      setLiveConnected(false);
      return;
    }

    const channelName = auctionPusherChannelName(auctionId.trim());
    channelNameRef.current = channelName;
    let cancelled = false;

    const onPriceDrop = (data: unknown) => {
      const raw = extractBidFromPusherPayload(data);
      if (!raw) return;
      const newBidData = normalizeAuctionBid(raw);
      if (!newBidData) return;
      setEvents((prev) => {
        const merged = mergeAuctionEventRows(prev, [newBidData]);
        setStanding(deriveStandingFromEvents(merged));
        const nextId = latestAuctionEventId(merged);
        if (nextId) lastEventIdRef.current = nextId;
        return merged;
      });
    };

    priceDropHandlerRef.current = onPriceDrop;

    (async () => {
      try {
        await loadPusherScript();
        if (cancelled || !window.Pusher) return;

        const existing = pusherRef.current;
        const existingChannel = channelNameRef.current;
        if (existing && existingChannel && existingChannel !== channelName) {
          try {
            existing.unsubscribe(existingChannel);
            existing.disconnect();
          } catch {
            // ignore
          }
        }

        const pusher = new window.Pusher(key, { cluster, forceTLS: true });
        pusherRef.current = pusher;

        const onConnected = () => {
          if (!cancelled) {
            setLiveConnected(true);
            void loadHistoryFull();
          }
        };
        pusher.connection.bind("connected", onConnected);

        const channel = pusher.subscribe(channelName);
        channel.bind("price_drop", onPriceDrop);

        if (!cancelled) setLiveConnected(true);
      } catch {
        if (!cancelled) setLiveConnected(false);
      }
    })();

    return () => {
      cancelled = true;
      setLiveConnected(false);
      const pusher = pusherRef.current;
      const ch = channelNameRef.current;
      const handler = priceDropHandlerRef.current;
      if (pusher && ch && handler) {
        try {
          const channel = pusher.subscribe(ch);
          channel.unbind("price_drop", handler);
          pusher.unsubscribe(ch);
          pusher.disconnect();
        } catch {
          // ignore
        }
      }
      pusherRef.current = null;
      channelNameRef.current = null;
      priceDropHandlerRef.current = null;
    };
  }, [auctionId, enabled, effectiveLive, loadHistoryFull]);

  return {
    events,
    standing,
    bids: standing,
    loading,
    error,
    liveConnected,
    reload: loadHistoryFull,
    bidsMeta,
    requirementStatus: bidsMeta.requirementStatus ?? "",
  };
}
