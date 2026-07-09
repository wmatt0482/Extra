"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// The page is a server component (force-dynamic), so router.refresh() re-runs
// the Todoist fetch and streams fresh data in without a full reload. We drive
// it on an interval, on window focus, and on demand — so the app tracks
// Todoist instead of showing a stale snapshot from when it opened.
export default function AutoRefresh({ intervalMs = 45000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const last = useRef(0);

  const refresh = useCallback(() => {
    // Coalesce bursts (focus + interval landing together).
    const now = Date.now();
    if (now - last.current < 2000) return;
    last.current = now;
    setRefreshing(true);
    router.refresh();
    // router.refresh() has no completion signal; approximate it.
    window.setTimeout(() => {
      setRefreshing(false);
      setSyncedAt(new Date());
    }, 700);
  }, [router]);

  useEffect(() => {
    setSyncedAt(new Date());
    const iv = window.setInterval(refresh, intervalMs);
    const onFocus = () => refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, intervalMs]);

  const time = syncedAt
    ? syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <button
      className={`refresh${refreshing ? " spin" : ""}`}
      onClick={refresh}
      disabled={refreshing}
      title="Refresh now"
    >
      <span className="ic">⟳</span>
      {time && <span className="synced">synced {time}</span>}
    </button>
  );
}
