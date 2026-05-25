/**
 * Standalone migration runner used by `npm run db:migrate`.
 *
 * Loads env from .env.local explicitly because this script runs outside the
 * Next.js runtime (no built-in env loading).
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Cannot run migrations.");
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  console.log("Migrations complete.");

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
