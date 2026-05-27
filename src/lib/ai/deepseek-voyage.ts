/**
 * Concrete ImageFeatureProvider that pairs DeepSeek-VL (vision -> description)
 * with a text embedding model (Voyage or OpenAI). DeepSeek itself does not
 * expose a native image embedding endpoint as of 2026-05, so this two-step
 * pipeline is what makes the social matching work today. Swap this class out
 * for a native image-embedding provider later without touching call sites.
 */
import "server-only";

import { describeImage } from "./deepseek";
import { embedText } from "./embedding";
import type { ImageFeature, ImageFeatureProvider, ImageInput, VisualDescription } from "./provider";

function composeEmbeddingText(d: VisualDescription): string {
  // Concatenate the prose summary with comma-separated tags and palette.
  // The repetition deliberately weights "matching axes" (style, mood,
  // palette) higher in the embedding than a bare prose summary would.
  return [
    d.summary,
    d.tags.length > 0 ? d.tags.join(", ") : null,
    d.palette && d.palette.length > 0 ? d.palette.join(", ") : null,
  ]
    .filter((s): s is string => s !== null && s.length > 0)
    .join("\n");
}

class DeepseekVoyageProvider implements ImageFeatureProvider {
  async describe(input: ImageInput): Promise<VisualDescription> {
    const { summary, tags, palette } = await describeImage(input);
    return { summary, tags, palette };
  }

  async embed(text: string): Promise<{ vector: number[]; model: string }> {
    return embedText(text);
  }

  async extract(input: ImageInput): Promise<ImageFeature> {
    const raw = await describeImage(input);
    const text = composeEmbeddingText(raw);
    const emb = await embedText(text);
    return {
      description: {
        summary: raw.summary,
        tags: raw.tags,
        palette: raw.palette,
      },
      embedding: emb.vector,
      visionModel: raw.rawModel,
      embeddingModel: emb.model,
    };
  }
}

export const deepseekVoyageProvider: ImageFeatureProvider = new DeepseekVoyageProvider();
