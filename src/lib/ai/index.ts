import { deepseekVoyageProvider } from "./deepseek-voyage";
import type { ImageFeatureProvider } from "./provider";

export type { ImageFeature, ImageFeatureProvider, ImageInput, VisualDescription } from "./provider";

/**
 * Returns the active image-feature provider. Today this is hard-wired to the
 * DeepSeek + text-embedding pipeline; once a native image-embedding service
 * is available, swap the body here without touching call sites.
 */
export function getImageFeatureProvider(): ImageFeatureProvider {
  return deepseekVoyageProvider;
}
