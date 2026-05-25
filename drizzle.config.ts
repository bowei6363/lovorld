import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// Load env from .env.local first, then fall back to .env. drizzle-kit runs
// outside the Next.js runtime so we cannot rely on its automatic env loading.
loadEnv({ path: ".env.local", override: true });
loadEnv({ path: ".env", override: false });

// Use a placeholder so `drizzle-kit generate` (offline diff) still works in
// fresh checkouts. Commands that actually open a connection (`push`,
// `migrate`, `studio`) will fail loudly with the real URL missing.
const url = process.env.DATABASE_URL ?? "postgres://lovorld:lovorld_dev@localhost:5432/lovorld";

export default defineConfig({
  schema: "./src/server/db/schema/*",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
