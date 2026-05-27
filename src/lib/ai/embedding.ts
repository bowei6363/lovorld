/**
 * Text embedding. Voyage if VOYAGE_API_KEY is set (recommended for our use
 * case — multilingual, strong on aesthetic descriptors); OpenAI otherwise.
 *
 * Both providers are configured to return 1024-d vectors so the result
 * fits the `vector(1024)` column in `post` and `user` tables. Switching
 * model dimensions later means a schema migration, so do it deliberately.
 */
import "server-only";

import { env } from "@/lib/env";

const EMBED_DIMS = 1024;

const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/embeddings";

export type EmbedResult = { vector: number[]; model: string };

async function embedWithVoyage(text: string, apiKey: string): Promise<EmbedResult> {
  const model = env.ai.voyage.model();
  const res = await fetch(VOYAGE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [text],
      input_type: "document",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Voyage embedding failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vector = json.data?.[0]?.embedding;
  if (!vector || !Array.isArray(vector)) {
    throw new Error("Voyage returned no embedding.");
  }
  if (vector.length !== EMBED_DIMS) {
    throw new Error(`Voyage returned ${vector.length}-d vector; expected ${EMBED_DIMS}.`);
  }
  return { vector, model };
}

async function embedWithOpenAI(text: string, apiKey: string): Promise<EmbedResult> {
  const model = env.ai.openai.embedModel();
  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
      // text-embedding-3-* supports `dimensions` to project down from 3072
      dimensions: EMBED_DIMS,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenAI embedding failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vector = json.data?.[0]?.embedding;
  if (!vector || !Array.isArray(vector)) {
    throw new Error("OpenAI returned no embedding.");
  }
  if (vector.length !== EMBED_DIMS) {
    throw new Error(`OpenAI returned ${vector.length}-d vector; expected ${EMBED_DIMS}.`);
  }
  return { vector, model };
}

export async function embedText(text: string): Promise<EmbedResult> {
  const voyageKey = env.ai.voyage.apiKey();
  if (voyageKey) return embedWithVoyage(text, voyageKey);

  const openaiKey = env.ai.openai.apiKey();
  if (openaiKey) return embedWithOpenAI(text, openaiKey);

  throw new Error(
    "No text-embedding provider configured. Set VOYAGE_API_KEY or OPENAI_API_KEY in .env.local.",
  );
}
