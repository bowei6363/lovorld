/**
 * Throwaway: peek at the users/posts in the production DB to debug
 * what's going on with a failing upload. Not meant to ship — delete or
 * keep as a debug aid.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });

import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { max: 1 });
  try {
    const users = await sql<
      Array<{
        id: string;
        name: string | null;
        handle: string | null;
        email: string;
        createdAt: Date;
      }>
    >`SELECT id, name, handle, email, "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 10`;
    console.log(`Users (latest ${users.length}):`);
    for (const u of users) {
      console.log(`  ${u.id}  ${u.handle ?? u.name ?? u.email}  ${u.createdAt.toISOString()}`);
    }

    const posts = await sql<
      Array<{
        id: string;
        userId: string;
        r2Key: string;
        status: string;
        description: string | null;
        createdAt: Date;
      }>
    >`SELECT id, "userId", "r2Key", status, description, "createdAt" FROM "post" ORDER BY "createdAt" DESC LIMIT 10`;
    console.log(`\nPosts (latest ${posts.length}):`);
    for (const p of posts) {
      console.log(
        `  ${p.id}  status=${p.status}  user=${p.userId.slice(0, 8)}…  ${p.createdAt.toISOString()}`,
      );
      if (p.description) {
        console.log(`    desc: ${p.description.slice(0, 120)}…`);
      }
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
