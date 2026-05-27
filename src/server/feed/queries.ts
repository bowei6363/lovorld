/**
 * Recommendation feed: pick the posts whose embeddings are closest to the
 * viewer's taste vector. The taste vector is the AVG of the viewer's own
 * `ready` posts' embeddings, maintained by `recomputeUserTaste`.
 *
 * Cold start: when the viewer has no taste vector yet (no analyzed posts),
 * fall back to a recency-ordered feed so they see something on day one.
 *
 * Cursor: simple offset for now. Switch to keyset on (similarity, id) once
 * the catalog is large enough for offset pagination to feel slow.
 */
import "server-only";

import { and, desc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { users } from "@/server/db/schema/auth";
import { posts } from "@/server/db/schema/posts";
import { publicUrlFor } from "@/server/storage/r2";

export type FeedItem = {
  id: string;
  imageUrl: string;
  caption: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
  similarity: number | null;
  author: {
    id: string;
    name: string | null;
    handle: string | null;
    image: string | null;
  };
};

const PAGE_SIZE = 20;

function toVectorLiteral(vec: number[]): string {
  // pgvector accepts text literals like '[1.2,3.4,...]' that cast to vector.
  // Doing the cast in SQL avoids fighting drizzle over how to serialize a
  // number[] parameter for the operator `<=>`.
  return `[${vec.join(",")}]`;
}

export async function getRecommendationFeed(
  viewerId: string,
  { offset = 0, limit = PAGE_SIZE }: { offset?: number; limit?: number } = {},
): Promise<{ items: FeedItem[]; nextOffset: number | null }> {
  const [viewer] = await db
    .select({ tasteEmbedding: users.tasteEmbedding })
    .from(users)
    .where(eq(users.id, viewerId))
    .limit(1);

  const taste = viewer?.tasteEmbedding ?? null;

  const baseFilter = and(eq(posts.status, "ready"), ne(posts.userId, viewerId));

  if (taste && taste.length > 0) {
    const literal = toVectorLiteral(taste);
    const distance = sql<number>`${posts.embedding} <=> ${literal}::vector`;

    const rows = await db
      .select({
        id: posts.id,
        r2Key: posts.r2Key,
        caption: posts.caption,
        description: posts.description,
        width: posts.width,
        height: posts.height,
        createdAt: posts.createdAt,
        distance,
        authorId: users.id,
        authorName: users.name,
        authorHandle: users.handle,
        authorImage: users.image,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(baseFilter)
      .orderBy(distance)
      .limit(limit + 1)
      .offset(offset);

    const items = rows.slice(0, limit).map((r) => ({
      id: r.id,
      imageUrl: publicUrlFor(r.r2Key),
      caption: r.caption,
      description: r.description,
      width: r.width,
      height: r.height,
      createdAt: r.createdAt,
      // Convert cosine distance (0=identical, 2=opposite) to 0–1 similarity
      similarity: 1 - r.distance / 2,
      author: {
        id: r.authorId,
        name: r.authorName,
        handle: r.authorHandle,
        image: r.authorImage,
      },
    }));

    return {
      items,
      nextOffset: rows.length > limit ? offset + limit : null,
    };
  }

  // Cold start: recency feed.
  const rows = await db
    .select({
      id: posts.id,
      r2Key: posts.r2Key,
      caption: posts.caption,
      description: posts.description,
      width: posts.width,
      height: posts.height,
      createdAt: posts.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorHandle: users.handle,
      authorImage: users.image,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(baseFilter)
    .orderBy(desc(posts.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const items = rows.slice(0, limit).map((r) => ({
    id: r.id,
    imageUrl: publicUrlFor(r.r2Key),
    caption: r.caption,
    description: r.description,
    width: r.width,
    height: r.height,
    createdAt: r.createdAt,
    similarity: null,
    author: {
      id: r.authorId,
      name: r.authorName,
      handle: r.authorHandle,
      image: r.authorImage,
    },
  }));

  return {
    items,
    nextOffset: rows.length > limit ? offset + limit : null,
  };
}

export async function getPostById(postId: string) {
  const [row] = await db
    .select({
      id: posts.id,
      r2Key: posts.r2Key,
      caption: posts.caption,
      description: posts.description,
      width: posts.width,
      height: posts.height,
      status: posts.status,
      createdAt: posts.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorHandle: users.handle,
      authorImage: users.image,
      authorBio: users.bio,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    imageUrl: publicUrlFor(row.r2Key),
    caption: row.caption,
    description: row.description,
    width: row.width,
    height: row.height,
    status: row.status,
    createdAt: row.createdAt,
    author: {
      id: row.authorId,
      name: row.authorName,
      handle: row.authorHandle,
      image: row.authorImage,
      bio: row.authorBio,
    },
  };
}

export async function getPostsByUser(userId: string, limit = 60) {
  const rows = await db
    .select({
      id: posts.id,
      r2Key: posts.r2Key,
      caption: posts.caption,
      status: posts.status,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    imageUrl: publicUrlFor(r.r2Key),
    caption: r.caption,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      image: users.image,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
