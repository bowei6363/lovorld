"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isDemoMode } from "@/lib/env";
import { verifySession } from "@/server/auth/dal";
import { demoLikes } from "@/server/demo/fixtures";
import { db } from "@/server/db/client";
import { posts } from "@/server/db/schema/posts";
import { comments, likes, notifications } from "@/server/db/schema/social";
import { USER_WRITE_LIMIT, requireRateLimit } from "@/server/limits";

const postIdSchema = z.object({ postId: z.string().uuid() });
const commentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

async function notifyPostOwner(opts: {
  postId: string;
  actorId: string;
  type: "post_like" | "post_comment";
  commentId?: string;
}) {
  const [post] = await db
    .select({ userId: posts.userId })
    .from(posts)
    .where(eq(posts.id, opts.postId))
    .limit(1);
  if (!post) return;
  // Don't notify yourself.
  if (post.userId === opts.actorId) return;

  await db.insert(notifications).values({
    recipientId: post.userId,
    actorId: opts.actorId,
    type: opts.type,
    postId: opts.postId,
    commentId: opts.commentId,
  });
}

export async function toggleLike(
  input: z.input<typeof postIdSchema>,
): Promise<{ liked: boolean; count: number }> {
  const { userId } = await verifySession();
  const { postId } = postIdSchema.parse(input);
  requireRateLimit(`like:${userId}`, USER_WRITE_LIMIT);

  if (isDemoMode()) {
    // Toggle in the in-memory fixture so the optimistic UI looks right
    // until the next page reload reseeds. Good enough for clicks-around.
    const l = demoLikes[postId];
    if (!l) return { liked: false, count: 0 };
    if (l.selfLiked) {
      l.selfLiked = false;
      l.count = Math.max(0, l.count - 1);
    } else {
      l.selfLiked = true;
      l.count += 1;
    }
    revalidatePath(`/p/${postId}`);
    return { liked: l.selfLiked, count: l.count };
  }

  const existing = await db
    .select({ postId: likes.postId })
    .from(likes)
    .where(and(eq(likes.postId, postId), eq(likes.userId, userId)))
    .limit(1);

  let liked: boolean;
  if (existing.length > 0) {
    await db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.userId, userId)));
    liked = false;
  } else {
    await db.insert(likes).values({ postId, userId });
    liked = true;
    await notifyPostOwner({ postId, actorId: userId, type: "post_like" });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.postId, postId));

  revalidatePath(`/p/${postId}`);
  return { liked, count: Number(count) };
}

export async function addComment(
  input: z.input<typeof commentSchema>,
): Promise<{ commentId: string }> {
  const { userId } = await verifySession();
  const { postId, body } = commentSchema.parse(input);
  requireRateLimit(`comment:${userId}`, USER_WRITE_LIMIT);

  if (isDemoMode()) {
    // Pretend it landed; the demo fixture list is read-only so the new
    // comment won't show up on reload, but the toast and input clear.
    void body;
    revalidatePath(`/p/${postId}`);
    return { commentId: `demo-comment-${Date.now()}` };
  }

  const [row] = await db
    .insert(comments)
    .values({ postId, userId, body })
    .returning({ id: comments.id });

  await notifyPostOwner({
    postId,
    actorId: userId,
    type: "post_comment",
    commentId: row.id,
  });

  revalidatePath(`/p/${postId}`);
  return { commentId: row.id };
}

export async function markAllNotificationsRead(): Promise<void> {
  const { userId } = await verifySession();
  if (isDemoMode()) {
    void userId;
    revalidatePath("/notifications");
    return;
  }
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientId, userId), sql`${notifications.readAt} IS NULL`));
  revalidatePath("/notifications");
}
