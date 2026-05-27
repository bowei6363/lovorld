/**
 * Social graph: likes, comments, and notifications.
 *
 * Likes are a join table keyed by (postId, userId) — a user can like a post
 * at most once. Comments and notifications use UUIDs because they are
 * referenced from URLs and links.
 *
 * Notifications denormalize the actor + post + (optional) comment so the
 * UI can render the line without follow-up queries. They are softly read
 * (`readAt`) rather than deleted so analytics can still see them.
 */
import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { posts } from "./posts";

export const likes = pgTable(
  "like",
  {
    postId: text("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] }), index("like_userId_idx").on(t.userId)],
);

export const comments = pgTable(
  "comment",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    postId: text("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("comment_postId_createdAt_idx").on(t.postId, t.createdAt.desc())],
);

export const notificationType = pgEnum("notification_type", ["post_like", "post_comment"]);

export const notifications = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    recipientId: text("recipientId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: text("actorId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    postId: text("postId").references(() => posts.id, { onDelete: "cascade" }),
    commentId: text("commentId").references(() => comments.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("readAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("notification_recipient_unread_idx").on(t.recipientId, t.readAt, t.createdAt.desc()),
  ],
);

export type Like = typeof likes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
