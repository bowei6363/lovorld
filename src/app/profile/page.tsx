import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/dal";
import { toOwnProfile } from "@/server/auth/dto";
import { db } from "@/server/db/client";
import { posts } from "@/server/db/schema/posts";
import { publicUrlFor } from "@/server/storage/r2";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const me = toOwnProfile(user);

  // Fetch my own posts so the profile page surfaces what I've uploaded —
  // this is where users actually see their own contributions, because the
  // feed deliberately excludes self.
  const myPosts = await db
    .select({
      id: posts.id,
      r2Key: posts.r2Key,
      caption: posts.caption,
      status: posts.status,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.userId, me.id))
    .orderBy(desc(posts.createdAt))
    .limit(60);

  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-16">
            {me.image ? <AvatarImage src={me.image} alt={me.name ?? "头像"} /> : null}
            <AvatarFallback>{(me.name ?? me.email).slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <CardTitle className="text-xl">{me.name ?? "未命名用户"}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {me.handle ? `@${me.handle}` : me.email}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {me.bio ? (
            <p className="leading-relaxed">{me.bio}</p>
          ) : (
            <p className="text-muted-foreground">还没有简介。（个人资料编辑功能稍后开放。）</p>
          )}
        </CardContent>
      </Card>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">我分享过的</h2>
        {myPosts.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center text-sm">
              <p>还没分享过任何图片。</p>
              <Link
                href="/upload"
                className="text-foreground mt-3 inline-block underline underline-offset-4"
              >
                上传第一张
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {myPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="group block">
                  <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={publicUrlFor(p.r2Key)}
                      alt={p.caption ?? "图片"}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  </div>
                  {p.status === "pending_analysis" ? (
                    <p className="text-muted-foreground mt-1 text-[11px]">AI 分析中…</p>
                  ) : p.status === "failed" ? (
                    <p className="text-destructive mt-1 text-[11px]">AI 分析失败</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
