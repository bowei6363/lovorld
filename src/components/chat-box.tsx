"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMessage } from "@/server/messages/actions";

export function ChatBox({ recipientId }: { recipientId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    startTransition(async () => {
      try {
        await sendMessage({ recipientId, body: text });
        setBody("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "发送失败。");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        placeholder="发条私信…"
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
