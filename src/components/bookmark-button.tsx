"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleBookmark } from "@/server/social/actions";

type Props = {
  postId: string;
  initialBookmarked: boolean;
};

export function BookmarkButton({ postId, initialBookmarked }: Props) {
  const [pending, startTransition] = useTransition();
  const [bookmarked, apply] = useOptimistic(initialBookmarked, (_curr, next: boolean) => next);

  function onClick() {
    if (pending) return;
    startTransition(async () => {
      apply(!bookmarked);
      try {
        await toggleBookmark({ postId });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "操作失败。");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={bookmarked ? "secondary" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-pressed={bookmarked}
    >
      {bookmarked ? "已收藏" : "收藏"}
    </Button>
  );
}
