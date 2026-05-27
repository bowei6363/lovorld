import { desc, eq } from "drizzle-orm";

import { verifySession } from "@/server/auth/dal";
import { db } from "@/server/db/client";
import { posts } from "@/server/db/schema/posts";
import { publicUrlFor } from "@/server/storage/r2";
import { Card, CardContent } from "@/components/ui/card";

// Milestone 5 will replace this with the similarity-based feed. For now we
// show the signed-in user's own recent uploads as a smoke test of the upload
// pipeline.
export default async function FeedPage() {
  const { userId } = await verifySession();

  const rows = await db
    .select({
      id: posts.id,
      r2Key: posts.r2Key,
      caption: posts.caption,
      status: posts.status,
      width: posts.width,
      height: posts.height,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(50);

  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Your uploads</h1>
        <p className="text-muted-foreground">
          The similarity-driven feed lands in a later milestone. For now, here are the images
          you&apos;ve shared.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Nothing yet. Share something you love to get started.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {rows.map((post) => (
            <li key={post.id}>
              <Card className="overflow-hidden">
                <div className="bg-muted relative aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrlFor(post.r2Key)}
                    alt={post.caption ?? "Uploaded image"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <CardContent className="space-y-1 py-4">
                  <p className="text-sm">
                    {post.caption ?? (
                      <span className="text-muted-foreground italic">No caption</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {post.status === "pending_analysis"
                      ? "AI analysis in progress…"
                      : post.status === "ready"
                        ? "Analyzed"
                        : "Analysis failed"}
                    {" · "}
                    {post.createdAt.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
