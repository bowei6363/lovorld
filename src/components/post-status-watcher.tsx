"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { checkPostStatus } from "@/server/posts/actions";

type Status = "pending_analysis" | "ready" | "failed";

type Props = {
  postId: string;
  initialStatus: Status;
};

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 40; // 40 × 2.5s = 100s — generous ceiling for AI latency

/**
 * Polls the server for a post's analysis status while it's still pending,
 * then calls `router.refresh()` once it flips to `ready` or `failed`. The
 * refresh re-runs the page's server components, which pulls the AI
 * description / status badge / etc. without a page reload.
 *
 * Renders nothing — it's a side-effect-only component.
 */
export function PostStatusWatcher({ postId, initialStatus }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (initialStatus !== "pending_analysis") return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      attempts += 1;
      try {
        const status = await checkPostStatus(postId);
        if (cancelled) return;
        if (status === "ready" || status === "failed") {
          router.refresh();
          return;
        }
      } catch {
        // Swallow transient errors — keep polling.
      }
      if (attempts < MAX_POLLS) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [postId, initialStatus, router]);

  return null;
}
