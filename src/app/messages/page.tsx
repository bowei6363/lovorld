import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { verifySession } from "@/server/auth/dal";
import { getConversations } from "@/server/messages/queries";

export const dynamic = "force-dynamic";

function initialsOf(name: string | null, fallback: string) {
  return (name ?? fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function MessagesPage() {
  const { userId } = await verifySession();
  const conversations = await getConversations(userId);

  return (
    <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">私信</h1>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            还没有私信。去信息流找到同好，点他主页的「私信」开聊吧。
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.otherUser.id}>
              <Link href={`/messages/${c.otherUser.id}`}>
                <Card className={c.unread > 0 ? "border-primary/40 bg-primary/[0.03]" : ""}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <Avatar className="size-10">
                      {c.otherUser.avatarEmoji ? (
                        <AvatarFallback className="text-xl">
                          {c.otherUser.avatarEmoji}
                        </AvatarFallback>
                      ) : c.otherUser.image ? (
                        <AvatarImage src={c.otherUser.image} alt={c.otherUser.name ?? "头像"} />
                      ) : (
                        <AvatarFallback>
                          {initialsOf(c.otherUser.name, c.otherUser.id)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {c.otherUser.handle
                            ? `@${c.otherUser.handle}`
                            : (c.otherUser.name ?? "用户")}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {c.lastAt.toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate text-sm">{c.lastBody}</p>
                    </div>
                    {c.unread > 0 ? (
                      <span className="bg-primary text-primary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold">
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
