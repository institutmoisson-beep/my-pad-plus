import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { logActivity } from "@/lib/activity";

/** Records page views, meaningful button taps and a presence heartbeat for the admin dashboard. */
export function ActivityTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(pathname);

  useEffect(() => {
    pathRef.current = pathname;
    logActivity(pathname);
  }, [pathname]);

  useEffect(() => {
    const beat = () => {
      if (document.visibilityState === "visible") logActivity(pathRef.current, "heartbeat");
    };
    const id = window.setInterval(beat, 45000);
    document.addEventListener("visibilitychange", beat);

    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("button, a[role='button']");
      if (!el) return;
      const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ");
      if (text.length < 3 || /^\d+$/.test(text)) return; // skip PIN digits / icons
      logActivity(pathRef.current, "click", text.slice(0, 60));
    };
    document.addEventListener("click", onClick, true);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
