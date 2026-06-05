"use client";

import { useEffect } from "react";

import { markConversationRead } from "@/server/messages/actions";

/**
 * Side-effect-only: marks a conversation read once the chat view mounts, so
 * the unread badge clears without the user doing anything. Fire-and-forget;
 * a failed mark just leaves the badge until next time.
 */
export function MarkReadOnMount({ otherUserId }: { otherUserId: string }) {
  useEffect(() => {
    markConversationRead(otherUserId).catch(() => {});
  }, [otherUserId]);
  return null;
}
