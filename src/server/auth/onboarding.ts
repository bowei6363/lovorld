"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { embedText } from "@/lib/ai/embedding";
import { isDemoMode } from "@/lib/env";
import { verifySession } from "@/server/auth/dal";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema/auth";

const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(40),
  emoji: z.string().trim().min(1).max(8),
  keywords: z.array(z.string().trim().min(1).max(20)).max(5),
});

/**
 * Finish onboarding: set the chosen display name + emoji avatar, and — the
 * important part — seed an initial taste vector from the aesthetic keywords.
 * This is what gives a brand-new user meaningful feed matches before they've
 * uploaded anything, which is the whole point of solving cold start.
 *
 * The keyword → embedding leg is best-effort: if the embedding provider
 * fails we still mark the user onboarded (they just start cold).
 */
export async function completeOnboarding(input: z.input<typeof onboardingSchema>): Promise<never> {
  const { userId } = await verifySession();
  const parsed = onboardingSchema.parse(input);

  if (isDemoMode()) redirect("/feed");

  let tasteEmbedding: number[] | null = null;
  if (parsed.keywords.length > 0) {
    try {
      const text = `${parsed.keywords.join("、")} 风格的图片，审美偏好`;
      const emb = await embedText(text);
      tasteEmbedding = emb.vector;
    } catch (err) {
      console.error("completeOnboarding: keyword embedding failed", err);
    }
  }

  await db
    .update(users)
    .set({
      name: parsed.name,
      avatarEmoji: parsed.emoji,
      tasteKeywords: parsed.keywords,
      ...(tasteEmbedding ? { tasteEmbedding, tasteUpdatedAt: new Date() } : {}),
      onboardedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  redirect("/feed");
}

export async function skipOnboarding(): Promise<never> {
  const { userId } = await verifySession();
  if (!isDemoMode()) {
    await db
      .update(users)
      .set({ onboardedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
  redirect("/feed");
}
