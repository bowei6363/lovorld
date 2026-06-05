/**
 * Seeds demo users + analyzed posts into the production DB to solve cold
 * start. Each post is genuinely run through the vision + embedding pipeline
 * so it participates in real similarity matching.
 *
 * AI calls are inlined (not imported from src/lib/ai) because those modules
 * start with `import "server-only"`, which throws under plain tsx.
 *
 * Requires env (load order: .env.local then .env.seed override):
 *   DATABASE_URL, VISION_*, EMBEDDING_*, BLOB_READ_WRITE_TOKEN, BLOB_PUBLIC_URL
 *
 * Run:  npx tsx src/scripts/seed-demo.ts
 * Idempotent-ish: skips a demo user if their email already exists.
 */
import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });
loadEnv({ path: ".env.seed", override: true });

import { put } from "@vercel/blob";
import postgres from "postgres";

type DemoUser = {
  handle: string;
  name: string;
  emoji: string;
  bio: string;
  keywords: string[];
  seeds: string[];
  captions: string[];
};

const DEMO_USERS: DemoUser[] = [
  {
    handle: "qingwu",
    name: "青雾",
    emoji: "🌙",
    bio: "山雾、留白、清冷调。",
    keywords: ["极简", "暗调", "自然"],
    seeds: [
      "lvld-mist-1",
      "lvld-mist-2",
      "lvld-mist-3",
      "lvld-mist-4",
      "lvld-mist-5",
      "lvld-mist-6",
    ],
    captions: ["晨雾里的山脊", "留白", "一个人的清晨", "雾散之前", "远峰", "安静的灰"],
  },
  {
    handle: "wanfeng",
    name: "盐于晚风",
    emoji: "🌊",
    bio: "海边长大，偏爱胶片的颗粒。",
    keywords: ["胶片感", "治愈系", "自然"],
    seeds: ["lvld-sea-1", "lvld-sea-2", "lvld-sea-3", "lvld-sea-4", "lvld-sea-5", "lvld-sea-6"],
    captions: ["落日收工", "浪的形状", "盐的味道", "退潮", "海风", "夏天的尾巴"],
  },
  {
    handle: "hntu",
    name: "混凝土",
    emoji: "🏙️",
    bio: "几何、光影、城市的硬边。",
    keywords: ["城市", "几何", "极简"],
    seeds: [
      "lvld-arch-1",
      "lvld-arch-2",
      "lvld-arch-3",
      "lvld-arch-4",
      "lvld-arch-5",
      "lvld-arch-6",
    ],
    captions: ["光的切割", "重复", "天井", "冷灰", "结构", "无人的楼"],
  },
  {
    handle: "nuanshi",
    name: "暖食记",
    emoji: "🍃",
    bio: "把好吃的拍得更好吃。",
    keywords: ["治愈系", "高饱和", "日系"],
    seeds: [
      "lvld-food-1",
      "lvld-food-2",
      "lvld-food-3",
      "lvld-food-4",
      "lvld-food-5",
      "lvld-food-6",
    ],
    captions: ["周末的早餐", "热气", "一碗治愈", "黄油色", "刚出炉", "慢食"],
  },
  {
    handle: "huashi",
    name: "花事",
    emoji: "🌸",
    bio: "微距、花瓣、梦里的颜色。",
    keywords: ["梦幻", "高饱和", "治愈系"],
    seeds: [
      "lvld-flower-1",
      "lvld-flower-2",
      "lvld-flower-3",
      "lvld-flower-4",
      "lvld-flower-5",
      "lvld-flower-6",
    ],
    captions: ["花瓣的褶皱", "粉色梦", "微距", "盛放", "一点红", "凝视"],
  },
];

const VISION_BASE = (process.env.VISION_BASE_URL ?? "").replace(/\/$/, "");
const VISION_KEY = process.env.VISION_API_KEY!;
const VISION_MODEL = process.env.VISION_MODEL ?? "qwen-vl-max";
const EMBED_BASE = (process.env.EMBEDDING_BASE_URL ?? "").replace(/\/$/, "");
const EMBED_KEY = process.env.EMBEDDING_API_KEY!;
const EMBED_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-v3";

function stripFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function describeImage(
  bytes: Uint8Array,
): Promise<{ summary: string; tags: string[]; palette: string[] }> {
  const b64 = Buffer.from(bytes).toString("base64");
  const res = await fetch(`${VISION_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${VISION_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
            {
              type: "text",
              text: '分析这张图，用简体中文回复 JSON：{"summary":"<40-80字描述主体/风格/色彩/情绪>","tags":["<5-10个中文标签>"],"palette":["#xxxxxx"]}。palette 给3-5个主色。只回 JSON。',
            },
          ],
        },
      ],
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`vision ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(stripFences(content)) as Record<string, unknown>;
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    palette: Array.isArray(parsed.palette)
      ? parsed.palette.filter(
          (c): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c),
        )
      : [],
  };
}

async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${EMBED_BASE}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${EMBED_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text,
      dimensions: 1024,
      encoding_format: "float",
    }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  const v = json.data?.[0]?.embedding;
  if (!v || v.length !== 1024) throw new Error(`bad embedding len ${v?.length}`);
  return v;
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("BLOB_READ_WRITE_TOKEN missing (run: vercel env pull .env.seed)");
  const sql = postgres(url, { max: 2 });

  try {
    for (const u of DEMO_USERS) {
      const email = `${u.handle}@demo.lovorld.local`;
      const existing = await sql`SELECT id FROM "user" WHERE email = ${email} LIMIT 1`;
      if (existing.length > 0) {
        console.log(`skip ${u.handle} (already seeded)`);
        continue;
      }

      const userId = randomUUID();
      await sql`
        INSERT INTO "user" (id, name, email, handle, bio, "avatarEmoji", "tasteKeywords", "onboardedAt", "createdAt", "updatedAt")
        VALUES (${userId}, ${u.name}, ${email}, ${u.handle}, ${u.bio}, ${u.emoji},
                ${JSON.stringify(u.keywords)}::jsonb, NOW(), NOW(), NOW())
      `;
      console.log(`+ user ${u.handle} (${userId.slice(0, 8)})`);

      for (let i = 0; i < u.seeds.length; i++) {
        const seed = u.seeds[i];
        const caption = u.captions[i] ?? null;
        const postId = randomUUID();
        const key = `users/${userId}/posts/${postId}/original.jpg`;

        const imgRes = await fetch(`https://picsum.photos/seed/${seed}/1200/900`);
        if (!imgRes.ok) {
          console.warn(`  ! image fetch failed for ${seed}`);
          continue;
        }
        const bytes = new Uint8Array(await imgRes.arrayBuffer());

        await put(key, Buffer.from(bytes), {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/jpeg",
        });

        const desc = await describeImage(bytes);
        const emb = await embedText(
          `${desc.summary}\n${desc.tags.join(", ")}\n${desc.palette.join(", ")}`,
        );

        await sql`
          INSERT INTO "post" (id, "userId", "r2Key", "mimeType", "byteSize", width, height,
                              caption, description, tags, palette, embedding,
                              "visionModel", "embeddingModel", status, "createdAt", "updatedAt")
          VALUES (${postId}, ${userId}, ${key}, 'image/jpeg', ${bytes.byteLength}, 1200, 900,
                  ${caption}, ${desc.summary}, ${JSON.stringify(desc.tags)}::jsonb,
                  ${JSON.stringify(desc.palette)}::jsonb, ${vectorLiteral(emb)}::vector,
                  ${VISION_MODEL}, ${EMBED_MODEL}, 'ready', NOW(), NOW())
        `;
        console.log(`  + post ${i + 1}/${u.seeds.length} "${caption ?? ""}"`);
      }

      await sql`
        UPDATE "user"
        SET "tasteEmbedding" = (
          SELECT AVG(embedding) FROM "post"
          WHERE "userId" = ${userId} AND status = 'ready' AND embedding IS NOT NULL
        ), "tasteUpdatedAt" = NOW()
        WHERE id = ${userId}
      `;
      console.log(`  = taste recomputed for ${u.handle}`);
    }

    console.log("\nSeed complete.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
