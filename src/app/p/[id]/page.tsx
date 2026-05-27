import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentBox } from "@/components/comment-box";
import { CommentList } from "@/components/comment-list";
import { LikeButton } from "@/components/like-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { tryGetCurrentUser } from "@/server/auth/dal";
import { getPostById } from "@/server/feed/queries";
import { getPostSocialState } from "@/server/social/queries";

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

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) return { title: "找不到内容" };
  const title = post.caption
    ? `${post.caption.slice(0, 60)} — lovorld`
    : `${post.author.name ?? "图片"} · lovorld`;
  return {
    title,
    description: post.description?.slice(0, 200) ?? undefined,
    openGraph: {
      title,
      description: post.description?.slice(0, 200),
      images: [{ url: post.imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [post.imageUrl],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  const me = await tryGetCurrentUser();
  const social = me ? await getPostSocialState(id, me.id) : { likeCount: 0, viewerLiked: false };

  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Card className="overflow-hidden">
        <div className="bg-muted relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt={post.caption ?? post.description ?? "图片"}
            className="h-auto w-full object-contain"
          />
        </div>
        <CardContent className="space-y-5 py-6">
          <div className="flex items-start justify-between gap-4">
            <Link
              href={`/u/${post.author.id}`}
              className="inline-flex items-center gap-3 hover:opacity-80"
            >
              <Avatar className="size-10">
                {post.author.image ? (
                  <AvatarImage src={post.author.image} alt={post.author.name ?? "头像"} />
                ) : null}
                <AvatarFallback>{initialsOf(post.author.name, post.author.id)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{post.author.name ?? "未命名用户"}</span>
                {post.author.handle ? (
                  <span className="text-muted-foreground text-xs">@{post.author.handle}</span>
                ) : null}
              </div>
            </Link>

            {me ? (
              <LikeButton
                postId={post.id}
                initialLiked={social.viewerLiked}
                initialCount={social.likeCount}
              />
            ) : (
              <Link href="/sign-in" className="text-muted-foreground text-sm hover:underline">
                登录后点赞
              </Link>
            )}
          </div>

          {post.caption ? <p className="text-base leading-relaxed">{post.caption}</p> : null}

          {post.description ? (
            <div className="bg-muted/30 space-y-2 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                AI 读到的画面
              </p>
              <p className="text-sm leading-relaxed">{post.description}</p>
            </div>
          ) : post.status === "pending_analysis" ? (
            <p className="text-muted-foreground text-sm">AI 正在分析画面…</p>
          ) : post.status === "failed" ? (
            <p className="text-destructive text-sm">AI 分析失败。</p>
          ) : null}

          <p className="text-muted-foreground text-xs">{post.createdAt.toLocaleString("zh-CN")}</p>
        </CardContent>
      </Card>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">评论</h2>
        {me ? <CommentBox postId={post.id} /> : null}
        <CommentList postId={post.id} />
      </section>
    </section>
  );
}
