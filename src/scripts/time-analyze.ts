/**
 * Two-part timing measurement for the upload → AI → publish pipeline.
 *
 * Part 1: scan existing posts and report wall-clock time from createdAt
 *         to updatedAt (status flipped to ready) per post. That's the
 *         end-to-end backend latency Vercel actually delivered.
 *
 * Part 2: run a synchronous repro against the production AI providers
 *         (DashScope vision + embedding) using a small test image to
 *         measure the model leg in isolation.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });

import postgres from "postgres";

const RED_16PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP4z8BAEiJN9aiGUQ1DSgMAkPn/Afnh+ngAAAAASUVORK5CYII=";

async function partOne() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql<
      Array<{
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        descLen: number;
      }>
    >`
      SELECT id, status, "createdAt", "updatedAt",
        COALESCE(LENGTH(description), 0) AS "descLen"
      FROM "post"
      ORDER BY "createdAt" DESC
      LIMIT 10
    `;
    console.log(`\n=== Existing posts (latest ${rows.length}) ===`);
    if (rows.length === 0) {
      console.log("  (no posts yet)");
      return;
    }
    for (const r of rows) {
      const ms = r.updatedAt.getTime() - r.createdAt.getTime();
      const tag =
        r.status === "ready"
          ? `analyzed in ${(ms / 1000).toFixed(1)}s`
          : `status=${r.status}, age=${(ms / 1000).toFixed(1)}s`;
      console.log(`  ${r.id.slice(0, 8)}…  ${tag}  (desc ${r.descLen} chars)`);
    }
  } finally {
    await sql.end();
  }
}

async function timeOnce(label: string, fn: () => Promise<unknown>) {
  const t0 = Date.now();
  try {
    await fn();
    return Date.now() - t0;
  } catch (err) {
    console.error(`  ${label} FAILED:`, err instanceof Error ? err.message : err);
    return Date.now() - t0;
  }
}

async function partTwo() {
  console.log("\n=== Live model timing (16×16 PNG, 3 runs) ===");
  const visionBase = (process.env.VISION_BASE_URL ?? "").replace(/\/$/, "");
  const visionKey = process.env.VISION_API_KEY;
  const visionModel = process.env.VISION_MODEL ?? "qwen-vl-max";
  const embedBase = (process.env.EMBEDDING_BASE_URL ?? "").replace(/\/$/, "");
  const embedKey = process.env.EMBEDDING_API_KEY;
  const embedModel = process.env.EMBEDDING_MODEL ?? "text-embedding-v3";

  if (!visionKey || !embedKey) throw new Error("VISION/EMBEDDING key missing");

  for (let i = 0; i < 3; i++) {
    const visionMs = await timeOnce("vision", async () => {
      const res = await fetch(`${visionBase}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${visionKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${RED_16PX_PNG_BASE64}`,
                  },
                },
                {
                  type: "text",
                  text: '请用一句简体中文描述这张图。回复 JSON：{"summary":"<文字>"}',
                },
              ],
            },
          ],
          max_tokens: 80,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    });

    const embedMs = await timeOnce("embed", async () => {
      const res = await fetch(`${embedBase}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${embedKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: embedModel,
          input: "一张全红色的简单图片",
          dimensions: 1024,
          encoding_format: "float",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    });

    console.log(
      `  run ${i + 1}: vision=${(visionMs / 1000).toFixed(2)}s  embed=${(embedMs / 1000).toFixed(2)}s  total=${((visionMs + embedMs) / 1000).toFixed(2)}s`,
    );
  }
}

async function main() {
  await partOne();
  await partTwo();
  console.log(
    "\nNote: production also adds tasteEmbedding recompute (~50-150ms) and the after() hand-off overhead (~100-300ms).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
