"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readJsonBody, resolveApiError } from "@/lib/api-client";
import {
  type AuctionBidRow,
  auctionPusherChannelName,
  extractBidFromPusherPayload,
  extractBidsPayload,
  normalizeAuctionBid,
  normalizeBidList,
  prependAuctionBid,
} from "@/lib/bidding/auction-bids";

type PusherChannel = {
  bind: (event: string, callback: (data: unknown) => void) => void;
  unbind: (event?: string, callback?: (data: unknown) => void) => void;
};

type PusherClient = {
  subscribe: (channelName: string) => PusherChannel;
  unsubscribe: (channelName: string) => void;
  disconnect: () => void;
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
};

export function useAuctionBidFeed({ auctionId, enabled, live }: UseAuctionBidFeedOptions) {
  const [bids, setBids] = useState<AuctionBidRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);
  const pusherRef = useRef<PusherClient | null>(null);
  const channelNameRef = useRef<string | null>(null);
  const priceDropHandlerRef = useRef<((data: unknown) => void) | null>(null);

  const loadHistory = useCallback(async () => {
    if (!enabled || !auctionId) {
      setBids([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/bidding-proxy/admin/auctions/${encodeURIComponent(auctionId)}/bids`
      );
      const data = await readJsonBody(res);
      if (!res.ok) {
        setBids([]);
        setError(resolveApiError(res, data, "Could not load bid history").message);
        return;
      }
      setBids(normalizeBidList(extractBidsPayload(data)));
    } catch {
      setBids([]);
      setError("Network error while loading bids");
    } finally {
      setLoading(false);
    }
  }, [auctionId, enabled]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!enabled || !live || !auctionId?.trim()) {
      setLiveConnected(false);
      return;
    }

    const key = process.env.NEXT_PUBLIC_BIDDING_PUSHER_KEY?.trim();
    const cluster = process.env.NEXT_PUBLIC_BIDDING_PUSHER_CLUSTER?.trim() || "ap2";
    if (!key) {
      console.warn(
        "[auction-bid-feed] NEXT_PUBLIC_BIDDING_PUSHER_KEY is missing — live price_drop updates disabled."
      );
      setLiveConnected(false);
      return;
    }

    const channelName = auctionPusherChannelName(auctionId.trim());
    channelNameRef.current = channelName;
    let cancelled = false;

    const onPriceDrop = (data: unknown) => {
      console.log("Pusher event received:", data);
      const raw = extractBidFromPusherPayload(data);
      if (!raw) {
        console.warn("[auction-bid-feed] price_drop payload could not be parsed", data);
        return;
      }
      const newBidData = normalizeAuctionBid(raw);
      if (!newBidData) {
        console.warn("[auction-bid-feed] price_drop missing bid amount/fields", raw);
        return;
      }
      setBids((prev) => prependAuctionBid(prev, newBidData));
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

        console.log("[auction-bid-feed] Pusher subscribing to channel:", channelName, {
          auctionId,
          cluster,
        });

        const channel = pusher.subscribe(channelName);
        channel.bind("price_drop", onPriceDrop);

        if (!cancelled) setLiveConnected(true);
      } catch (e) {
        console.error("[auction-bid-feed] Pusher setup failed", e);
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
          // ignore teardown errors
        }
      }
      pusherRef.current = null;
      channelNameRef.current = null;
      priceDropHandlerRef.current = null;
    };
  }, [auctionId, enabled, live]);

  return { bids, loading, error, liveConnected, reload: loadHistory };
}
