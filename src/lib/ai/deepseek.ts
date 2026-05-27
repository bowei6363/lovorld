/**
 * Vision provider: image → structured JSON description.
 *
 * Speaks OpenAI's chat/completions wire format. The active provider is
 * controlled by VISION_BASE_URL / VISION_API_KEY / VISION_MODEL — defaults
 * point at Alibaba DashScope (qwen-vl-max), but anything that accepts the
 * same shape works. File is named `deepseek.ts` for historical reasons;
 * it has nothing DeepSeek-specific in it any more.
 *
 * Some providers refuse `response_format: json_object` (DashScope did,
 * historically). We fall back to extracting JSON from the raw text reply
 * with markdown-fence stripping rather than depending on the structured
 * output mode.
 */
import "server-only";

import { env } from "@/lib/env";
import type { ImageInput, VisualDescription } from "./provider";

const SYSTEM_PROMPT =
  "你是一位懂艺术的图像分析师。对任何图片，你都会输出一个紧凑的 JSON，捕捉这张图的视觉本质——像策展人那样精准描述。你的回复永远是单个 JSON 对象，不带任何额外说明。";

const USER_PROMPT = `分析这张图片，严格按以下 JSON 结构回复（所有文字必须用简体中文）：
{
  "summary": "<一段（约 40-80 个汉字）描述：主体、风格、构图、色彩、情绪>",
  "tags": ["<5-12 个简短标签，覆盖主体/风格/调色/情绪/时代等维度，简体中文>"],
  "palette": ["#xxxxxx"]
}
palette 必须是 3-5 个主导色，6 位十六进制格式，按占比从高到低排序。
只回复这一个 JSON 对象——不要 markdown 围栏，不要额外说明。`;

type ChatContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function imageToContentItem(input: ImageInput): ChatContentItem {
  if (input.kind === "url") {
    return { type: "image_url", image_url: { url: input.url } };
  }
  const b64 = Buffer.from(input.data).toString("base64");
  return {
    type: "image_url",
    image_url: { url: `data:${input.mimeType};base64,${b64}` },
  };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function isHex(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
}

export type RawVisualDescription = VisualDescription & { rawModel: string };

export async function describeImage(input: ImageInput): Promise<RawVisualDescription> {
  const baseUrl = env.ai.vision.baseUrl();
  const apiKey = env.ai.vision.apiKey();
  const model = env.ai.vision.model();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [imageToContentItem(input), { type: "text", text: USER_PROMPT }],
        },
      ],
      temperature: 0.4,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Vision provider failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Vision provider returned no content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(content));
  } catch (err) {
    // Some providers wrap the JSON in prose. Try to recover the first
    // {...} block before giving up.
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        throw new Error(
          `Vision provider returned non-JSON: ${content.slice(0, 200)} (${(err as Error).message})`,
        );
      }
    } else {
      throw new Error(
        `Vision provider returned non-JSON: ${content.slice(0, 200)} (${(err as Error).message})`,
      );
    }
  }

  const obj = parsed as Record<string, unknown>;
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];
  const palette = Array.isArray(obj.palette) ? obj.palette.filter(isHex) : undefined;

  if (!summary) {
    throw new Error("Vision provider response missing 'summary'.");
  }

  return { summary, tags, palette, rawModel: model };
}
