/**
 * DeepSeek vision: image -> structured JSON description.
 *
 * DeepSeek's chat/completions API is OpenAI-compatible, so the request shape
 * matches GPT-4V calls. We force JSON via `response_format` and parse client
 * side — the model occasionally wraps JSON in markdown despite instructions,
 * so we strip code fences defensively before parsing.
 */
import "server-only";

import { env } from "@/lib/env";
import type { ImageInput, VisualDescription } from "./provider";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

const SYSTEM_PROMPT =
  "You are an art-attuned image analyst. For any image, you produce a compact JSON description capturing its visual essence — what an art curator would say. You always reply with a single JSON object.";

const USER_PROMPT = `Analyze this image and reply with this exact JSON shape:
{
  "summary": "<one paragraph (40-80 words) describing subject, style, composition, color, and mood>",
  "tags": ["<5-12 short tags covering subject / style / palette / mood / era>"],
  "palette": ["#xxxxxx"]
}
The palette must contain 3-5 dominant colors as 6-digit hex, ordered by prevalence.
Reply with ONLY the JSON object — no markdown, no commentary.`;

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
  const apiKey = env.ai.deepseek.apiKey();
  const model = env.ai.deepseek.visionModel();

  const res = await fetch(DEEPSEEK_ENDPOINT, {
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
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `DeepSeek vision failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned no content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(content));
  } catch (err) {
    throw new Error(
      `DeepSeek returned non-JSON: ${content.slice(0, 200)} (${(err as Error).message})`,
    );
  }

  const obj = parsed as Record<string, unknown>;
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];
  const palette = Array.isArray(obj.palette) ? obj.palette.filter(isHex) : undefined;

  if (!summary) {
    throw new Error("DeepSeek description missing 'summary'.");
  }

  return { summary, tags, palette, rawModel: model };
}
