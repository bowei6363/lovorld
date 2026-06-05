import Link from "next/link";
import { notFound } from "next/navigation";

import { FollowButton } from "@/components/follow-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { tryGetCurrentUser } from "@/server/auth/dal";
import { getPostsByUser, getUserProfile } from "@/server/feed/queries";
import { getFollowSummary } from "@/server/social/queries";

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

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params;
  const user = await getUserProfile(id);
  if (!user) notFound();

  const [viewer, posts, follow] = await Promise.all([
    tryGetCurrentUser(),
    getPostsByUser(id),
    getFollowSummary(id, null),
  ]);
  // Re-resolve viewerFollowing with the actual viewer (getFollowSummary
  // above was called with null to run in parallel; cheap second call only
  // when logged in and not self).
  const follow2 = viewer && viewer.id !== id ? await getFollowSummary(id, viewer.id) : follow;

  const isSelf = viewer?.id === id;

  return (
    <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-10 flex items-start justify-between gap-5">
        <div className="flex items-center gap-5">
          <Avatar className="size-20">
            {user.avatarEmoji ? (
              <AvatarFallback className="text-3xl">{user.avatarEmoji}</AvatarFallback>
            ) : user.image ? (
              <AvatarImage src={user.image} alt={user.name ?? "头像"} />
            ) : (
              <AvatarFallback className="text-lg">{initialsOf(user.name, user.id)}</AvatarFallback>
            )}
          </Avatar>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{user.name ?? "未命名用户"}</h1>
            {user.handle ? <p className="text-muted-foreground text-sm">@{user.handle}</p> : null}
            <p className="text-muted-foreground mt-1 text-sm">
              <span className="text-foreground font-medium">{follow2.followers}</span> 粉丝 ·{" "}
              <span className="text-foreground font-medium">{follow2.following}</span> 关注 ·{" "}
              <span className="text-foreground font-medium">{posts.length}</span> 作品
            </p>
            {user.bio ? <p className="mt-2 max-w-prose text-sm">{user.bio}</p> : null}
          </div>
        </div>

        {viewer && !isSelf ? (
          <FollowButton
            targetUserId={id}
            initialFollowing={follow2.viewerFollowing}
            initialFollowers={follow2.followers}
          />
        ) : null}
      </header>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            还没分享过任何内容。
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/p/${p.id}`} className="group block">
                <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt={p.caption ?? "图片"}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
