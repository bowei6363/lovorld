"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleLike } from "@/server/social/actions";

type Props = {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
};

export function LikeButton({ postId, initialLiked, initialCount }: Props) {
  const [pending, startTransition] = useTransition();
  const [state, applyOptimistic] = useOptimistic(
    { liked: initialLiked, count: initialCount },
    (curr, next: { liked: boolean }) => ({
      liked: next.liked,
      count: curr.count + (next.liked ? 1 : -1),
    }),
  );

  function onClick() {
    if (pending) return;
    startTransition(async () => {
      applyOptimistic({ liked: !state.liked });
      try {
        await toggleLike({ postId });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not like.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={state.liked ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-pressed={state.liked}
    >
      {state.liked ? "Liked" : "Like"} · {state.count}
    </Button>
  );
}
