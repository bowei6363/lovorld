import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { verifySession } from "@/server/auth/dal";
import { getBookmarkedPosts } from "@/server/social/queries";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const { userId } = await verifySession();
  const items = await getBookmarkedPosts(userId);

  return (
    <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">我的收藏</h1>
        <p className="text-muted-foreground">你收藏起来的图，只有你自己看得到。</p>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            <p>还没有收藏。</p>
            <Link
              href="/feed"
              className="text-foreground mt-3 inline-block underline underline-offset-4"
            >
              去信息流逛逛
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((p) => (
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
