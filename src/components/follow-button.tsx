"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/server/social/actions";

type Props = {
  targetUserId: string;
  initialFollowing: boolean;
  initialFollowers: number;
};

export function FollowButton({ targetUserId, initialFollowing, initialFollowers }: Props) {
  const [pending, startTransition] = useTransition();
  const [state, apply] = useOptimistic(
    { following: initialFollowing, followers: initialFollowers },
    (curr, next: boolean) => ({
      following: next,
      followers: curr.followers + (next ? 1 : -1),
    }),
  );

  function onClick() {
    if (pending) return;
    startTransition(async () => {
      apply(!state.following);
      try {
        await toggleFollow({ targetUserId });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "操作失败。");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={state.following ? "outline" : "default"}
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-pressed={state.following}
    >
      {state.following ? "已关注" : "关注"}
    </Button>
  );
}
