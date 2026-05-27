/**
 * Posts: the core lovorld unit. One row per image upload.
 *
 * - `r2Key` points at the original in object storage; the bytes never live
 *   in Postgres.
 * - `embedding vector(1024)` reserves the slot for the AI feature vector
 *   that milestone 4 will populate. We use 1024 dims to fit
 *   Voyage voyage-3-large; switch to a different model => bump dims =>
 *   write a new migration. Indexes (HNSW / IVFFlat) are built in milestone 4.
 * - `status` tracks the async analysis pipeline so the feed can hide / show
 *   posts that aren't yet enriched.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const postStatus = pgEnum("post_status", ["pending_analysis", "ready", "failed"]);

export const posts = pgTable(
  "post",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    r2Key: text("r2Key").notNull(),
    mimeType: text("mimeType").notNull(),
    byteSize: integer("byteSize").notNull(),
    width: integer("width"),
    height: integer("height"),

    caption: text("caption"),

    // Populated by the AI pipeline in milestone 4.
    description: text("description"),
    embedding: vector("embedding", { dimensions: 1024 }),
    visionModel: text("visionModel"),
    embeddingModel: text("embeddingModel"),

    status: postStatus("status").notNull().default("pending_analysis"),

    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("post_r2Key_unique").on(table.r2Key),
    index("post_userId_createdAt_idx").on(table.userId, table.createdAt.desc()),
    index("post_status_idx").on(table.status),
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
