"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addComment } from "@/server/social/actions";

export function CommentBox({ postId }: { postId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = body.trim();
    if (!text || pending) return;

    startTransition(async () => {
      try {
        await addComment({ postId, body: text });
        setBody("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "评论发送失败。");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        placeholder="说点什么…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={pending}
        maxLength={2000}
      />
      <Button type="submit" size="sm" disabled={pending || !body.trim()}>
        {pending ? "发送中…" : "发送"}
      </Button>
    </form>
  );
}
