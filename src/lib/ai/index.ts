export type { ImageFeature, ImageFeatureProvider, ImageInput, VisualDescription } from "./provider";

/**
 * Concrete providers will live alongside this file (e.g. deepseek-voyage.ts)
 * and be selected here based on env vars in the next milestone.
 */
export function getImageFeatureProvider(): never {
  throw new Error(
    "ImageFeatureProvider implementation is not wired yet. " +
      "Implement deepseek-voyage.ts in milestone 4 (AI feature extraction).",
  );
}
