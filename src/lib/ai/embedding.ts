/**
 * Text embedding provider, OpenAI-compatible. Defaults to Alibaba DashScope
 * (text-embedding-v3, dimensions=1024). Override with EMBEDDING_BASE_URL /
 * EMBEDDING_API_KEY / EMBEDDING_MODEL.
 *
 * MUST return 1024-d vectors — that's the dimensionality of the
 * `vector(1024)` columns on `post.embedding` and `user.tasteEmbedding`.
 * Switching dimensions is a schema migration, not a config change, so we
 * check loudly here rather than failing later inside Drizzle.
 */
import "server-only";

import { env } from "@/lib/env";

const EMBED_DIMS = 1024;

export type EmbedResult = { vector: number[]; model: string };

export async function embedText(text: string): Promise<EmbedResult> {
  const baseUrl = env.ai.embedding.baseUrl();
  const apiKey = env.ai.embedding.apiKey();
  const model = env.ai.embedding.model();

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
      dimensions: EMBED_DIMS,
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Embedding provider failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vector = json.data?.[0]?.embedding;
  if (!vector || !Array.isArray(vector)) {
    throw new Error("Embedding provider returned no vector.");
  }
  if (vector.length !== EMBED_DIMS) {
    throw new Error(
      `Embedding provider returned ${vector.length}-d vector; lovorld's schema expects ${EMBED_DIMS}-d. Pick a different model or change the dimensions request.`,
    );
  }
  return { vector, model };
}
