import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

// Reuse the connection across HMR reloads in development so we don't exhaust
// the Postgres connection pool every time a file changes.
declare global {
  var __lovorld_postgres__: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__lovorld_postgres__ ??
  postgres(env.db.url(), {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__lovorld_postgres__ = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
