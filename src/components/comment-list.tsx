import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCommentsForPost } from "@/server/social/queries";

function initialsOf(name: string | null, fallback: string) {
  return (name ?? fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export async function CommentList({ postId }: { postId: string }) {
  const items = await getCommentsForPost(postId);
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Be the first to say something.</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((c) => (
        <li key={c.id} className="flex gap-3">
          <Link href={`/u/${c.authorId}`} className="shrink-0">
            <Avatar className="size-8">
              {c.authorImage ? (
                <AvatarImage src={c.authorImage} alt={c.authorName ?? "Avatar"} />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {initialsOf(c.authorName, c.authorId)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 space-y-1">
            <div className="flex items-baseline gap-2 text-sm">
              <Link href={`/u/${c.authorId}`} className="font-medium hover:underline">
                {c.authorHandle ? `@${c.authorHandle}` : (c.authorName ?? "Anonymous")}
              </Link>
              <span className="text-muted-foreground text-xs">{c.createdAt.toLocaleString()}</span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
