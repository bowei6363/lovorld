import Link from "next/link";
import { notFound } from "next/navigation";

import { getPostById } from "@/server/feed/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function initialsOf(name: string | null, fallback: string) {
  return (name ?? fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Card className="overflow-hidden">
        <div className="bg-muted relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt={post.caption ?? post.description ?? "Image"}
            className="h-auto w-full object-contain"
          />
        </div>
        <CardContent className="space-y-5 py-6">
          <Link
            href={`/u/${post.author.id}`}
            className="inline-flex items-center gap-3 hover:opacity-80"
          >
            <Avatar className="size-10">
              {post.author.image ? (
                <AvatarImage src={post.author.image} alt={post.author.name ?? "Avatar"} />
              ) : null}
              <AvatarFallback>{initialsOf(post.author.name, post.author.id)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{post.author.name ?? "Anonymous"}</span>
              {post.author.handle ? (
                <span className="text-muted-foreground text-xs">@{post.author.handle}</span>
              ) : null}
            </div>
          </Link>

          {post.caption ? <p className="text-base leading-relaxed">{post.caption}</p> : null}

          {post.description ? (
            <div className="bg-muted/30 space-y-2 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                What AI sees
              </p>
              <p className="text-sm leading-relaxed">{post.description}</p>
            </div>
          ) : post.status === "pending_analysis" ? (
            <p className="text-muted-foreground text-sm">Visual analysis is in progress.</p>
          ) : null}

          <p className="text-muted-foreground text-xs">{post.createdAt.toLocaleString()}</p>
        </CardContent>
      </Card>
    </section>
  );
}
