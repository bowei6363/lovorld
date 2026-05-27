/**
 * Post analysis worker. Runs the AI pipeline against one post:
 *   - fetch the image from R2 via its public URL
 *   - DeepSeek-VL -> structured description
 *   - text embedder -> 1024-d vector
 *   - persist into `post` and flip status to `ready`
 *
 * Designed to be idempotent and crash-tolerant: re-running on the same post
 * is safe; on any failure we flip status to `failed` and swallow the error so
 * the `after()` callback that invokes us doesn't poison the request response.
 */
import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { getImageFeatureProvider } from "@/lib/ai";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema/auth";
import { posts } from "@/server/db/schema/posts";
import { publicUrlFor } from "@/server/storage/r2";

export async function analyzePost(postId: string): Promise<void> {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);

  if (!post) {
    console.error(`analyzePost: post ${postId} not found`);
    return;
  }
  if (post.status === "ready") {
    return; // idempotent — analysis already landed
  }

  try {
    const provider = getImageFeatureProvider();
    const feature = await provider.extract({
      kind: "url",
      url: publicUrlFor(post.r2Key),
    });

    await db
      .update(posts)
      .set({
        description: feature.description.summary,
        embedding: feature.embedding,
        visionModel: feature.visionModel,
        embeddingModel: feature.embeddingModel,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));

    // Refresh the uploader's taste vector now that they have a new ready
    // post. Cheap to do inline because the AVG is over a single user's
    // posts and the failure case is "stale taste vector", not a crash.
    try {
      await recomputeUserTaste(post.userId);
    } catch (recomputeErr) {
      console.error(`analyzePost: taste recompute failed for user ${post.userId}`, recomputeErr);
    }
  } catch (err) {
    console.error(`analyzePost: failed for post ${postId}`, err);
    await db
      .update(posts)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(posts.id, postId));
  }
}

/**
 * Bulk catch-up: pick the oldest N pending posts and analyze them. Useful for
 * a cron / one-off recovery after a provider outage.
 */
export async function analyzePendingPosts(limit = 20): Promise<number> {
  const pending = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.status, "pending_analysis"))
    .limit(limit);

  for (const row of pending) {
    await analyzePost(row.id);
  }
  return pending.length;
}

/**
 * Recompute a user's taste vector as the average of their ready posts'
 * embeddings. pgvector ≥0.5 supports `AVG(vector)`, returning a vector of
 * the same dimensionality. NULL is written back if the user has no ready
 * posts (the feed treats NULL taste as "cold start").
 */
export async function recomputeUserTaste(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      tasteEmbedding: sql`(
        SELECT AVG(${posts.embedding})
        FROM ${posts}
        WHERE ${and(eq(posts.userId, userId), eq(posts.status, "ready"), isNotNull(posts.embedding))}
      )`,
      tasteUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
