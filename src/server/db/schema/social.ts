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
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

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

export const notificationType = pgEnum("notification_type", [
  "post_like",
  "post_comment",
  "new_follower",
]);

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

/**
 * Follow graph. (followerId follows followingId.) One row per directed edge.
 * Self-follows are blocked in the action layer, not the schema.
 */
export const follows = pgTable(
  "follow",
  {
    followerId: text("followerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("followingId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follow_following_idx").on(t.followingId),
  ],
);

/**
 * Bookmarks = personal saves. Distinct from likes (which are author-facing
 * appreciation). A user saves a post for their own collection.
 */
export const bookmarks = pgTable(
  "bookmark",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    index("bookmark_user_createdAt_idx").on(t.userId, t.createdAt.desc()),
  ],
);

/**
 * Direct messages. Flat table; a "conversation" is just all rows between two
 * user ids in either direction. Fine until volume demands a conversations
 * table with a denormalized last-message pointer.
 */
export const messages = pgTable(
  "message",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    senderId: text("senderId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: text("recipientId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    readAt: timestamp("readAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("message_pair_idx").on(t.senderId, t.recipientId, t.createdAt.desc()),
    index("message_recipient_unread_idx").on(t.recipientId, t.readAt),
  ],
);

/**
 * Per-user aesthetic clusters. Instead of one averaged taste vector (which
 * collapses a user with two distinct tastes into a meaningless midpoint), we
 * k-means their post embeddings into up to 3 centroids and recall from each.
 * `size` is how many posts fed the centroid — used to weight recall.
 */
export const tasteClusters = pgTable(
  "taste_cluster",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    centroid: vector("centroid", { dimensions: 1024 }).notNull(),
    size: integer("size").notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.idx] })],
);

export const reportReason = pgEnum("report_reason", ["spam", "nsfw", "copyright", "other"]);

/** Content reports. Backend is intentionally minimal — just capture signal. */
export const reports = pgTable(
  "report",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    reporterId: text("reporterId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    reason: reportReason("reason").notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("report_reporter_post_unique").on(t.reporterId, t.postId)],
);

export type Like = typeof likes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type TasteCluster = typeof tasteClusters.$inferSelect;
export type Report = typeof reports.$inferSelect;
