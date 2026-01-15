import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { createBoundsSnapshot, shouldUpdateBounds, type BoundsSnapshot } from "./bounds";

type Props = {
  url: string | null;
  visible: boolean;
  className?: string;
  closeOnUnmount?: boolean;
};

export function CodexEmbeddedWebview({
  url,
  visible,
  className,
  closeOnUnmount = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastBoundsRef = useRef<BoundsSnapshot | null>(null);
  const boundsRetryRef = useRef<{ timer: number | null; count: number }>({
    timer: null,
    count: 0,
  });
  const [created, setCreated] = useState(false);

  const syncBounds = async () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      if (boundsRetryRef.current.count < 60) {
        boundsRetryRef.current.count += 1;
        if (boundsRetryRef.current.timer) {
          window.clearTimeout(boundsRetryRef.current.timer);
        }
        boundsRetryRef.current.timer = window.setTimeout(() => {
          syncBounds().catch(() => {});
        }, 50);
      }
      return;
    }
    const nextRaw = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
    if (!shouldUpdateBounds(lastBoundsRef.current, nextRaw)) return;
    const next = createBoundsSnapshot(nextRaw);
    lastBoundsRef.current = next;
    boundsRetryRef.current.count = 0;
    await invoke("update_codex_webview_bounds", {
      x: next.normalized.x,
      y: next.normalized.y,
      width: next.normalized.width,
      height: next.normalized.height,
    });
  };

  useEffect(() => {
    let canceled = false;
    let retryTimer: number | null = null;
    let retryCount = 0;
    const maxRetries = 60;

    const run = async () => {
      if (!url) {
        if (created) {
          await invoke("set_codex_webview_visible", { visible: false });
        }
        return;
      }

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        if (retryCount < maxRetries && !canceled) {
          retryCount += 1;
          if (retryTimer) window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(() => {
            run().catch(() => {});
          }, 50);
        }
        return;
      }

      const exists = await invoke<boolean>("codex_webview_exists");
      if (canceled) return;

      if (!exists) {
        await invoke("create_codex_webview", {
          url,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
        lastBoundsRef.current = createBoundsSnapshot({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
        setCreated(true);
      } else {
        setCreated(true);
        await invoke("navigate_codex_webview", { url });
        await syncBounds();
      }
    };

    run().catch(() => {});
    return () => {
      canceled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!visible) {
      invoke("set_codex_webview_visible", { visible: false }).catch(() => {});
      return;
    }

    lastBoundsRef.current = null;
    const ensureVisible = async () => {
      await syncBounds();
      await invoke("set_codex_webview_visible", { visible: true });
    };
    ensureVisible().catch(() => {});

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      syncBounds().catch(() => {});
      if (attempts >= 8) {
        window.clearInterval(interval);
      }
    }, 120);
    return () => window.clearInterval(interval);
  }, [created, visible]);

  useEffect(() => {
    if (!created) return;
    const handle = () => syncBounds().catch(() => {});
    const observer = new ResizeObserver(handle);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);

  useEffect(() => {
    return () => {
      if (boundsRetryRef.current.timer) {
        window.clearTimeout(boundsRetryRef.current.timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!closeOnUnmount) return;
    return () => {
      invoke("close_codex_webview").catch(() => {});
    };
  }, [closeOnUnmount]);

  useEffect(() => {
    if (closeOnUnmount) return;
    return () => {
      invoke("set_codex_webview_visible", { visible: false }).catch(() => {});
    };
  }, [closeOnUnmount]);

  return (
    <div
      ref={containerRef}
      className={
        className ??
        "w-full h-full rounded-xl border border-slate-200/10 overflow-hidden bg-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
      }
    />
  );
}
