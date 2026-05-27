"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { verifySession } from "@/server/auth/dal";
import { db } from "@/server/db/client";
import { posts } from "@/server/db/schema/posts";
import { analyzePost } from "@/server/posts/analyze";
import {
  UploadValidationError,
  assertUploadableImage,
  createPresignedPutUrl,
  objectExists,
  objectKeyFor,
} from "@/server/storage/r2";

const intentSchema = z.object({
  mimeType: z.string().min(1).max(64),
  byteSize: z.number().int().positive(),
});

const finalizeSchema = z.object({
  postId: z.string().uuid(),
  r2Key: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(64),
  byteSize: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  caption: z.string().trim().max(500).optional(),
});

export type UploadIntent = {
  postId: string;
  r2Key: string;
  uploadUrl: string;
  expiresInSeconds: number;
};

/**
 * Step 1: client tells us the mime/size, we mint a postId, generate a
 * presigned PUT URL for R2, and hand back everything the client needs to
 * upload directly without touching this server again.
 */
export async function createUploadIntent(
  input: z.input<typeof intentSchema>,
): Promise<UploadIntent> {
  const { userId } = await verifySession();
  const parsed = intentSchema.parse(input);

  try {
    assertUploadableImage(parsed.mimeType, parsed.byteSize);
  } catch (err) {
    if (err instanceof UploadValidationError) {
      throw new Error(err.message);
    }
    throw err;
  }

  const postId = randomUUID();
  const r2Key = objectKeyFor({
    userId,
    postId,
    mimeType: parsed.mimeType,
  });

  const expiresInSeconds = 600;
  const uploadUrl = await createPresignedPutUrl({
    key: r2Key,
    contentType: parsed.mimeType,
    contentLength: parsed.byteSize,
    expiresInSeconds,
  });

  return { postId, r2Key, uploadUrl, expiresInSeconds };
}

/**
 * Step 2: client confirms the PUT succeeded. We verify R2 actually has the
 * object (don't trust the client), then insert the post row in
 * `pending_analysis` so the AI pipeline can pick it up later.
 */
export async function finalizePost(
  input: z.input<typeof finalizeSchema>,
): Promise<{ postId: string }> {
  const { userId } = await verifySession();
  const parsed = finalizeSchema.parse(input);

  // The r2Key embeds {userId}/{postId}; anyone tampering will land on a key
  // the user doesn't own and HeadObject will 404. Defense in depth:
  const expectedKey = objectKeyFor({
    userId,
    postId: parsed.postId,
    mimeType: parsed.mimeType,
  });
  if (parsed.r2Key !== expectedKey) {
    throw new Error("Upload key mismatch.");
  }

  const exists = await objectExists(parsed.r2Key);
  if (!exists) {
    throw new Error("Upload not found in storage. Did the upload finish?");
  }

  await db.insert(posts).values({
    id: parsed.postId,
    userId,
    r2Key: parsed.r2Key,
    mimeType: parsed.mimeType,
    byteSize: parsed.byteSize,
    width: parsed.width,
    height: parsed.height,
    caption: parsed.caption,
    status: "pending_analysis",
  });

  // Kick the AI pipeline off after the response is flushed so the user
  // doesn't wait on DeepSeek + embedding round-trips. analyzePost is
  // crash-tolerant and updates status itself.
  after(async () => {
    await analyzePost(parsed.postId);
  });

  return { postId: parsed.postId };
}

/**
 * Convenience wrapper for the upload form: finalize then redirect to the
 * post / feed. Server actions can throw redirects, which trumps any error
 * boundary — so call this last.
 */
export async function finalizePostAndRedirect(
  input: z.input<typeof finalizeSchema>,
): Promise<never> {
  await finalizePost(input);
  redirect("/feed");
}
