import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ChatBox } from "@/components/chat-box";
import { MarkReadOnMount } from "@/components/mark-read-on-mount";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { verifySession } from "@/server/auth/dal";
import { getConversation, getUserBrief } from "@/server/messages/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ userId: string }> };

function initialsOf(name: string | null, fallback: string) {
  return (name ?? fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ConversationPage({ params }: Props) {
  const { userId: otherId } = await params;
  const { userId } = await verifySession();
  if (otherId === userId) redirect("/messages");

  const other = await getUserBrief(otherId);
  if (!other) notFound();

  const chat = await getConversation(userId, otherId);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-6">
      <MarkReadOnMount otherUserId={otherId} />

      <header className="mb-4 flex items-center gap-3 border-b pb-4">
        <Link href="/messages" className="text-muted-foreground text-sm">
          ←
        </Link>
        <Link href={`/u/${other.id}`} className="flex items-center gap-2 hover:opacity-80">
          <Avatar className="size-9">
            {other.avatarEmoji ? (
              <AvatarFallback className="text-lg">{other.avatarEmoji}</AvatarFallback>
            ) : other.image ? (
              <AvatarImage src={other.image} alt={other.name ?? "头像"} />
            ) : (
              <AvatarFallback>{initialsOf(other.name, other.id)}</AvatarFallback>
            )}
          </Avatar>
          <span className="text-sm font-medium">
            {other.handle ? `@${other.handle}` : (other.name ?? "用户")}
          </span>
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {chat.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">还没有消息，说第一句吧。</p>
        ) : (
          chat.map((m) => (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  m.mine ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {m.body}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-background sticky bottom-0 border-t py-3">
        <ChatBox recipientId={otherId} />
      </div>
    </section>
  );
}
