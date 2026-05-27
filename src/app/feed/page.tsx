import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { verifySession } from "@/server/auth/dal";
import { getRecommendationFeed } from "@/server/feed/queries";

export const dynamic = "force-dynamic";

function initialsOf(name: string | null, fallback: string) {
  return (name ?? fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function FeedPage() {
  const { userId } = await verifySession();
  const { items } = await getRecommendationFeed(userId);

  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">我的信息流</h1>
        <p className="text-muted-foreground">和你审美相通的人。你分享得越多，AI 的匹配越精准。</p>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground space-y-3 py-12 text-center text-sm">
            <p>暂时还没有匹配你口味的内容。</p>
            <p>
              先去{" "}
              <Link href="/upload" className="text-foreground underline underline-offset-4">
                上传一张你喜欢的图
              </Link>
              ，或把链接分享给朋友一起逛——参与的人越多，AI 的推荐越准。
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="overflow-hidden">
                <Link href={`/p/${item.id}`} className="block">
                  <div className="bg-muted relative aspect-[4/3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.caption ?? item.description ?? "图片"}
                      className="h-full w-full object-cover transition group-hover:scale-[1.01]"
                    />
                  </div>
                </Link>
                <CardContent className="space-y-3 py-4">
                  <Link
                    href={`/u/${item.author.id}`}
                    className="flex items-center gap-2 hover:opacity-80"
                  >
                    <Avatar className="size-7">
                      {item.author.image ? (
                        <AvatarImage src={item.author.image} alt={item.author.name ?? "头像"} />
                      ) : null}
                      <AvatarFallback className="text-[10px]">
                        {initialsOf(item.author.name, item.author.id)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {item.author.handle
                        ? `@${item.author.handle}`
                        : (item.author.name ?? "某位用户")}
                    </span>
                  </Link>
                  {item.caption ? <p className="text-sm">{item.caption}</p> : null}
                  {item.similarity !== null ? (
                    <p className="text-muted-foreground text-xs">
                      口味契合度 {Math.round(item.similarity * 100)}%
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      {item.createdAt.toLocaleDateString("zh-CN")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
