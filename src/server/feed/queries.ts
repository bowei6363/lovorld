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

import { isDemoMode } from "@/lib/env";
import {
  DEMO_SELF_ID,
  demoPosts,
  demoSimilarity,
  demoUsers,
  findDemoPost,
  findDemoUser,
} from "@/server/demo/fixtures";
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
  if (isDemoMode()) {
    const others = demoPosts
      .filter((p) => p.userId !== viewerId)
      .map((p) => ({
        post: p,
        similarity: demoSimilarity[p.id] ?? 0.5,
      }))
      .sort((a, b) => b.similarity - a.similarity);
    const page = others.slice(offset, offset + limit);
    const nextOffset = others.length > offset + limit ? offset + limit : null;
    const items: FeedItem[] = page.map(({ post, similarity }) => {
      const author = findDemoUser(post.userId)!;
      return {
        id: post.id,
        imageUrl: post.imageUrl,
        caption: post.caption,
        description: post.description,
        width: post.width,
        height: post.height,
        createdAt: post.createdAt,
        similarity,
        author: {
          id: author.id,
          name: author.name,
          handle: author.handle,
          image: author.image,
        },
      };
    });
    return { items, nextOffset };
  }

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
  // demoUsers reference kept to satisfy the dead-code analyzer when
  // demo mode is off — it short-circuits above.
  void demoUsers;
  void DEMO_SELF_ID;

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
  if (isDemoMode()) {
    const post = findDemoPost(postId);
    if (!post) return null;
    const author = findDemoUser(post.userId);
    if (!author) return null;
    return {
      id: post.id,
      imageUrl: post.imageUrl,
      caption: post.caption,
      description: post.description,
      tags: [] as string[],
      palette: [] as string[],
      width: post.width,
      height: post.height,
      status: post.status,
      createdAt: post.createdAt,
      author: {
        id: author.id,
        name: author.name,
        handle: author.handle,
        image: author.image,
        avatarEmoji: null as string | null,
        bio: author.bio,
      },
    };
  }

  const [row] = await db
    .select({
      id: posts.id,
      r2Key: posts.r2Key,
      caption: posts.caption,
      description: posts.description,
      tags: posts.tags,
      palette: posts.palette,
      width: posts.width,
      height: posts.height,
      status: posts.status,
      createdAt: posts.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorHandle: users.handle,
      authorImage: users.image,
      authorEmoji: users.avatarEmoji,
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
    tags: row.tags ?? [],
    palette: row.palette ?? [],
    width: row.width,
    height: row.height,
    status: row.status,
    createdAt: row.createdAt,
    author: {
      id: row.authorId,
      name: row.authorName,
      handle: row.authorHandle,
      image: row.authorImage,
      avatarEmoji: row.authorEmoji,
      bio: row.authorBio,
    },
  };
}

export async function getPostsByUser(userId: string, limit = 60) {
  if (isDemoMode()) {
    return demoPosts
      .filter((p) => p.userId === userId)
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        imageUrl: p.imageUrl,
        caption: p.caption,
        status: p.status,
        createdAt: p.createdAt,
      }));
  }

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
  if (isDemoMode()) {
    const u = findDemoUser(userId);
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      handle: u.handle,
      image: u.image,
      avatarEmoji: null as string | null,
      bio: u.bio,
      createdAt: u.createdAt,
    };
  }

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      image: users.image,
      avatarEmoji: users.avatarEmoji,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/**
 * "品味相近的分享" — given a post, find OTHER users' ready posts whose
 * embedding is closest to this one. Powers the post-detail recommendation
 * strip. Excludes the source post and its author so the user discovers new
 * people, not their own work.
 */
export type SimilarPost = {
  id: string;
  imageUrl: string;
  caption: string | null;
  similarity: number;
  author: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarEmoji: string | null;
  };
};

export async function getSimilarPostsToPost(postId: string, limit = 6): Promise<SimilarPost[]> {
  if (isDemoMode()) {
    return demoPosts
      .filter((p) => p.id !== postId)
      .slice(0, limit)
      .map((p) => {
        const author = findDemoUser(p.userId)!;
        return {
          id: p.id,
          imageUrl: p.imageUrl,
          caption: p.caption,
          similarity: demoSimilarity[p.id] ?? 0.8,
          author: {
            id: author.id,
            name: author.name,
            handle: author.handle,
            avatarEmoji: null,
          },
        };
      });
  }

  const [src] = await db
    .select({ embedding: posts.embedding, userId: posts.userId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!src?.embedding) return [];

  const literal = `[${src.embedding.join(",")}]`;
  const distance = sql<number>`${posts.embedding} <=> ${literal}::vector`;

  const rows = await db
    .select({
      id: posts.id,
      r2Key: posts.r2Key,
      caption: posts.caption,
      distance,
      authorId: users.id,
      authorName: users.name,
      authorHandle: users.handle,
      authorEmoji: users.avatarEmoji,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(and(eq(posts.status, "ready"), ne(posts.id, postId), ne(posts.userId, src.userId)))
    .orderBy(distance)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    imageUrl: publicUrlFor(r.r2Key),
    caption: r.caption,
    similarity: 1 - r.distance / 2,
    author: {
      id: r.authorId,
      name: r.authorName,
      handle: r.authorHandle,
      avatarEmoji: r.authorEmoji,
    },
  }));
}
