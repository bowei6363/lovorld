"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { completeOnboarding, skipOnboarding } from "@/server/auth/onboarding";

const EMOJIS = ["🎨", "🌙", "🌿", "📷", "✨", "🔥", "🌊", "🍃", "🖤", "🌸", "🏙️", "🎞️"];

const KEYWORDS = [
  "极简",
  "复古",
  "暗调",
  "明亮",
  "治愈系",
  "赛博朋克",
  "自然",
  "城市",
  "胶片感",
  "高饱和",
  "莫兰迪",
  "黑白",
  "梦幻",
  "几何",
  "日系",
  "北欧",
];

const MAX_KEYWORDS = 3;

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [skipping, startSkip] = useTransition();

  function toggleKeyword(k: string) {
    setKeywords((curr) => {
      if (curr.includes(k)) return curr.filter((x) => x !== k);
      if (curr.length >= MAX_KEYWORDS) {
        toast.info(`最多选 ${MAX_KEYWORDS} 个`);
        return curr;
      }
      return [...curr, k];
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || pending) return;
    startTransition(async () => {
      try {
        await completeOnboarding({ name: name.trim(), emoji, keywords });
      } catch (err) {
        // redirect() throws NEXT_REDIRECT — that's success, not an error.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
          return;
        }
        toast.error(err instanceof Error ? err.message : "保存失败。");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          给自己起个昵称
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="比如：夜行的猫"
          maxLength={40}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">挑一个头像</p>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={cn(
                "flex size-11 items-center justify-center rounded-full border text-xl transition",
                emoji === e ? "border-primary ring-primary/40 ring-2" : "hover:bg-muted",
              )}
              aria-pressed={emoji === e}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          你偏爱什么样的画面？
          <span className="text-muted-foreground ml-1 font-normal">
            （选 1-3 个，AI 会用它给你初始推荐）
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {KEYWORDS.map((k) => {
            const active = keywords.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKeyword(k)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                )}
                aria-pressed={active}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={skipping || pending}
          onClick={() =>
            startSkip(async () => {
              try {
                await skipOnboarding();
              } catch (err) {
                if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
                  return;
                }
              }
            })
          }
        >
          跳过
        </Button>
        <Button type="submit" size="lg" disabled={pending || !name.trim()}>
          {pending ? "保存中…" : "开始逛 lovorld"}
        </Button>
      </div>
    </form>
  );
}
