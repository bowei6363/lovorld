/**
 * Read-side queries for the social layer (likes, comments, notifications).
 * Mutations live in actions.ts.
 */
import "server-only";

import { aliasedTable, and, asc, desc, eq, sql } from "drizzle-orm";

import { isDemoMode } from "@/lib/env";
import {
  demoComments,
  demoLikes,
  demoNotifications,
  findDemoPost,
  findDemoUser,
} from "@/server/demo/fixtures";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema/auth";
import { posts } from "@/server/db/schema/posts";
import { comments, likes, notifications } from "@/server/db/schema/social";
import { publicUrlFor } from "@/server/storage/r2";

export async function getPostSocialState(postId: string, viewerId: string) {
  if (isDemoMode()) {
    const l = demoLikes[postId];
    void viewerId;
    return {
      likeCount: l?.count ?? 0,
      viewerLiked: l?.selfLiked ?? false,
    };
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.postId, postId));
  const likeCount = Number(countRow?.count ?? 0);

  const liked = await db
    .select({ postId: likes.postId })
    .from(likes)
    .where(and(eq(likes.postId, postId), eq(likes.userId, viewerId)))
    .limit(1);

  return { likeCount, viewerLiked: liked.length > 0 };
}

export async function getCommentsForPost(postId: string) {
  if (isDemoMode()) {
    return demoComments
      .filter((c) => c.postId === postId)
      .map((c) => {
        const author = findDemoUser(c.authorId)!;
        return {
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          authorId: author.id,
          authorName: author.name,
          authorHandle: author.handle,
          authorImage: author.image,
        };
      })
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorHandle: users.handle,
      authorImage: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt))
    .limit(200);
  return rows;
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  if (isDemoMode()) {
    void userId;
    return demoNotifications.filter((n) => n.readAt === null).length;
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), sql`${notifications.readAt} IS NULL`));
  return Number(row?.count ?? 0);
}

export type NotificationItem = {
  id: string;
  type: "post_like" | "post_comment";
  createdAt: Date;
  readAt: Date | null;
  actor: {
    id: string;
    name: string | null;
    handle: string | null;
    image: string | null;
  };
  post: {
    id: string;
    imageUrl: string;
  } | null;
  commentBody: string | null;
};

export async function getNotifications(userId: string, limit = 50): Promise<NotificationItem[]> {
  if (isDemoMode()) {
    void userId;
    return demoNotifications
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((n) => {
        const actor = findDemoUser(n.actorId)!;
        const post = n.postId ? findDemoPost(n.postId) : null;
        return {
          id: n.id,
          type: n.type,
          createdAt: n.createdAt,
          readAt: n.readAt,
          actor: {
            id: actor.id,
            name: actor.name,
            handle: actor.handle,
            image: actor.image,
          },
          post: post ? { id: post.id, imageUrl: post.imageUrl } : null,
          commentBody: n.commentBody,
        };
      });
  }

  const actor = aliasedTable(users, "actor");

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      actorId: actor.id,
      actorName: actor.name,
      actorHandle: actor.handle,
      actorImage: actor.image,
      postId: posts.id,
      postR2Key: posts.r2Key,
      commentBody: comments.body,
    })
    .from(notifications)
    .innerJoin(actor, eq(notifications.actorId, actor.id))
    .leftJoin(posts, eq(notifications.postId, posts.id))
    .leftJoin(comments, eq(notifications.commentId, comments.id))
    .where(eq(notifications.recipientId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    createdAt: r.createdAt,
    readAt: r.readAt,
    actor: {
      id: r.actorId,
      name: r.actorName,
      handle: r.actorHandle,
      image: r.actorImage,
    },
    post: r.postId && r.postR2Key ? { id: r.postId, imageUrl: publicUrlFor(r.postR2Key) } : null,
    commentBody: r.commentBody,
  }));
}
