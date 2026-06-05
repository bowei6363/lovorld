import Link from "next/link";
import { notFound } from "next/navigation";

import { BookmarkButton } from "@/components/bookmark-button";
import { CommentBox } from "@/components/comment-box";
import { CommentList } from "@/components/comment-list";
import { LikeButton } from "@/components/like-button";
import { PostStatusWatcher } from "@/components/post-status-watcher";
import { ReportButton } from "@/components/report-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { tryGetCurrentUser } from "@/server/auth/dal";
import { getPostById, getSimilarPostsToPost } from "@/server/feed/queries";
import { getPostBookmarkState, getPostSocialState } from "@/server/social/queries";

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
    twitter: { card: "summary_large_image", title, images: [post.imageUrl] },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  const me = await tryGetCurrentUser();
  const [social, bookmarked, similar] = await Promise.all([
    me ? getPostSocialState(id, me.id) : Promise.resolve({ likeCount: 0, viewerLiked: false }),
    me ? getPostBookmarkState(id, me.id) : Promise.resolve(false),
    post.status === "ready" ? getSimilarPostsToPost(id, 6) : Promise.resolve([]),
  ]);

  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <PostStatusWatcher postId={post.id} initialStatus={post.status} />
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
                {post.author.avatarEmoji ? (
                  <AvatarFallback className="text-xl">{post.author.avatarEmoji}</AvatarFallback>
                ) : post.author.image ? (
                  <AvatarImage src={post.author.image} alt={post.author.name ?? "头像"} />
                ) : (
                  <AvatarFallback>{initialsOf(post.author.name, post.author.id)}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{post.author.name ?? "未命名用户"}</span>
                {post.author.handle ? (
                  <span className="text-muted-foreground text-xs">@{post.author.handle}</span>
                ) : null}
              </div>
            </Link>

            {me ? (
              <div className="flex items-center gap-2">
                <BookmarkButton postId={post.id} initialBookmarked={bookmarked} />
                <LikeButton
                  postId={post.id}
                  initialLiked={social.viewerLiked}
                  initialCount={social.likeCount}
                />
              </div>
            ) : (
              <Link href="/sign-in" className="text-muted-foreground text-sm hover:underline">
                登录后点赞收藏
              </Link>
            )}
          </div>

          {post.caption ? <p className="text-base leading-relaxed">{post.caption}</p> : null}

          {post.description ? (
            <div className="bg-muted/30 space-y-3 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                AI 读到的画面
              </p>
              <p className="text-sm leading-relaxed">{post.description}</p>

              {post.palette.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  {post.palette.map((c) => (
                    <div
                      key={c}
                      className="size-6 rounded-md border"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              ) : null}

              {post.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((t) => (
                    <span key={t} className="bg-muted rounded-full px-2.5 py-0.5 text-xs">
                      #{t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : post.status === "pending_analysis" ? (
            <p className="text-muted-foreground text-sm">AI 正在分析画面…</p>
          ) : post.status === "failed" ? (
            <p className="text-destructive text-sm">AI 分析失败。</p>
          ) : null}

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              {post.createdAt.toLocaleString("zh-CN")}
            </p>
            {me && me.id !== post.author.id ? <ReportButton postId={post.id} /> : null}
          </div>
        </CardContent>
      </Card>

      {similar.length > 0 ? (
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">品味相近的分享</h2>
          <p className="text-muted-foreground -mt-2 text-sm">这些人和你看到了同一种美。</p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {similar.map((s) => (
              <li key={s.id}>
                <Link href={`/p/${s.id}`} className="group block">
                  <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt={s.caption ?? "图片"}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                    <span className="bg-background/85 absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
                      契合 {Math.round(s.similarity * 100)}%
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {s.author.handle ? `@${s.author.handle}` : (s.author.name ?? "某位用户")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">评论</h2>
        {me ? <CommentBox postId={post.id} /> : null}
        <CommentList postId={post.id} />
      </section>
    </section>
  );
}
