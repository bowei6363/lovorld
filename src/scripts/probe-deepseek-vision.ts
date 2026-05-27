/**
 * One-shot probe: confirm the configured DeepSeek model accepts vision input.
 * Inlined fetch on purpose — we don't import deepseek.ts because that file
 * starts with `import "server-only"` which throws under plain tsx (Next.js
 * normally aliases "server-only" to a no-op at build time).
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });

const RED_PIXEL_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");
  const model = process.env.DEEPSEEK_VISION_MODEL ?? "deepseek-v4-flash";

  console.log(`Probing DeepSeek model "${model}" with a 1×1 PNG…\n`);

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${RED_PIXEL_BASE64}`,
              },
            },
            {
              type: "text",
              text: 'Reply with this JSON only: {"summary":"<one short sentence about the image>","tags":["red"],"palette":["#ff0000"]}',
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    }),
  });

  console.log(`HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();

  if (!res.ok) {
    console.error("✗ Body:", text.slice(0, 1000));
    process.exit(1);
  }

  console.log("✓ Raw body:", text.slice(0, 800));
  try {
    const parsed = JSON.parse(text) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = parsed.choices?.[0]?.message?.content;
    console.log("\n✓ Assistant content:", content);
  } catch {
    console.warn("(body was not JSON, model probably can't do vision)");
  }
}

main().catch((err) => {
  console.error("Probe crashed:", err);
  process.exit(1);
});
