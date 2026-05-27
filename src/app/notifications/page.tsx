import Link from "next/link";

import { verifySession } from "@/server/auth/dal";
import { markAllNotificationsRead } from "@/server/social/actions";
import { getNotifications } from "@/server/social/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function initialsOf(name: string | null, fallback: string) {
  return (name ?? fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function describe(n: { type: "post_like" | "post_comment"; commentBody: string | null }): string {
  if (n.type === "post_like") return "liked your image";
  if (n.commentBody) {
    const trimmed = n.commentBody.length > 80 ? `${n.commentBody.slice(0, 80)}…` : n.commentBody;
    return `commented: "${trimmed}"`;
  }
  return "commented on your image";
}

export default async function NotificationsPage() {
  const { userId } = await verifySession();
  const items = await getNotifications(userId);

  return (
    <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <form
          action={async () => {
            "use server";
            await markAllNotificationsRead();
          }}
        >
          <Button type="submit" variant="ghost" size="sm">
            Mark all read
          </Button>
        </form>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Nothing here yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card className={n.readAt ? "" : "border-primary/40 bg-primary/[0.03]"}>
                <CardContent className="flex items-center gap-3 py-4">
                  <Link href={`/u/${n.actor.id}`} className="shrink-0">
                    <Avatar className="size-9">
                      {n.actor.image ? (
                        <AvatarImage src={n.actor.image} alt={n.actor.name ?? "Avatar"} />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {initialsOf(n.actor.name, n.actor.id)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 text-sm">
                    <p>
                      <Link href={`/u/${n.actor.id}`} className="font-medium hover:underline">
                        {n.actor.handle ? `@${n.actor.handle}` : (n.actor.name ?? "Someone")}
                      </Link>{" "}
                      {describe(n)}
                    </p>
                    <p className="text-muted-foreground text-xs">{n.createdAt.toLocaleString()}</p>
                  </div>
                  {n.post ? (
                    <Link href={`/p/${n.post.id}`} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={n.post.imageUrl}
                        alt="Thumbnail"
                        className="size-12 rounded-md object-cover"
                      />
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
