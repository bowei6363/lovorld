/**
 * Two-step pipeline:
 *   image bytes/URL -> structured visual description (vision LLM)
 *                   -> dense vector (text embedding model)
 *
 * The interface is intentionally provider-agnostic. The first concrete
 * implementation pairs DeepSeek-VL with a text embedding model (Voyage or
 * OpenAI) because DeepSeek does not currently expose a native image embedding
 * API. Swap to a native image-embedding provider by implementing this
 * interface without touching call sites.
 */

export type ImageInput =
  | { kind: "url"; url: string }
  | { kind: "bytes"; data: Uint8Array; mimeType: string };

export interface VisualDescription {
  /** One-paragraph natural-language description suitable for embedding. */
  summary: string;
  /** Short tag list — style, subject, palette, mood, etc. */
  tags: string[];
  /** Dominant colors as hex strings, ordered by prevalence. */
  palette?: string[];
}

export interface ImageFeature {
  description: VisualDescription;
  /** Unit-normalized dense vector. Length is provider-specific. */
  embedding: number[];
  /** Provider identifiers used to produce this feature; needed to invalidate. */
  visionModel: string;
  embeddingModel: string;
}

export interface ImageFeatureProvider {
  describe(input: ImageInput): Promise<VisualDescription>;
  embed(text: string): Promise<{ vector: number[]; model: string }>;
  extract(input: ImageInput): Promise<ImageFeature>;
}
