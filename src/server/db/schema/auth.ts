/**
 * Drizzle schema for Auth.js v5 (NextAuth) using the standard 4-table layout:
 * users, accounts, sessions, verificationTokens. Column names match what
 * @auth/drizzle-adapter expects out of the box — do not rename them.
 *
 * Business-domain fields (handle, bio) live on `users` to keep the profile
 * close to the identity. Feed/social tables will live in separate schema files.
 */
import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "user",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),

    // Lovorld profile extensions
    handle: text("handle"),
    bio: text("bio"),

    // Aggregate "taste vector" — the average embedding of this user's
    // ready posts. Recomputed by analyzePost when each new post finishes
    // analysis. Drives the similarity feed in milestone 5.
    tasteEmbedding: vector("tasteEmbedding", { dimensions: 1024 }),
    tasteUpdatedAt: timestamp("tasteUpdatedAt", { mode: "date" }),

    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_email_unique").on(table.email),
    uniqueIndex("user_handle_unique").on(table.handle),
  ],
);

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
