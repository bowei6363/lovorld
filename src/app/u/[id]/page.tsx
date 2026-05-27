import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getPostsByUser, getUserProfile } from "@/server/feed/queries";

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

  const posts = await getPostsByUser(id);

  return (
    <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-10 flex items-center gap-5">
        <Avatar className="size-20">
          {user.image ? <AvatarImage src={user.image} alt={user.name ?? "头像"} /> : null}
          <AvatarFallback className="text-lg">{initialsOf(user.name, user.id)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">{user.name ?? "未命名用户"}</h1>
          {user.handle ? <p className="text-muted-foreground text-sm">@{user.handle}</p> : null}
          {user.bio ? <p className="mt-2 max-w-prose text-sm">{user.bio}</p> : null}
        </div>
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
