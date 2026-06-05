"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reportPost } from "@/server/social/actions";

type Reason = "spam" | "nsfw" | "copyright" | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "spam", label: "垃圾/广告" },
  { value: "nsfw", label: "不适内容" },
  { value: "copyright", label: "侵权盗图" },
  { value: "other", label: "其他" },
];

export function ReportButton({ postId }: { postId: string }) {
  const [pending, startTransition] = useTransition();

  function report(reason: Reason) {
    if (pending) return;
    startTransition(async () => {
      try {
        await reportPost({ postId, reason });
        toast.success("已收到你的举报，谢谢。");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "举报失败。");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" disabled={pending} aria-label="举报" />}
      >
        举报
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>举报原因</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {REASONS.map((r) => (
          <DropdownMenuItem key={r.value} onClick={() => report(r.value)}>
            {r.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
