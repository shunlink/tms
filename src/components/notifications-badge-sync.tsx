"use client";

import { useEffect } from "react";

/** After the notifications page loads (server marks items read), refresh sidebar badge counts. */
export default function NotificationsBadgeSync() {
  useEffect(() => {
    window.dispatchEvent(new Event("sidebar-counts-refresh"));
  }, []);
  return null;
}
