/**
 * Server-side storage forwarder. Handles uploads for the "local" and
 * "vercel-blob" backends; the R2 backend bypasses this route entirely by
 * giving the client a direct presigned PUT URL.
 *
 *   PUT  /api/storage/<key>
 *     - local backend  → writes ./uploads/<key>
 *     - vercel-blob    → calls @vercel/blob put(key, ...) with addRandomSuffix=false
 *
 *   GET  /api/storage/<key>
 *     - local backend  → streams the file back
 *     - vercel-blob    → not used (publicUrlFor returns the Vercel CDN URL)
 *
 * Security: PUT requires a valid session AND the key must start with
 * `users/<currentUserId>/`. GETs are public on purpose — feed images need
 * to render for unauthenticated viewers too.
 */
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { isLocalStorage, isVercelBlob, storageBackend } from "@/lib/env";
import {
  assertUploadableImage,
  localMimeFromKey,
  objectExists,
  openLocalObjectStream,
  UploadValidationError,
  writeLocalObject,
  writeVercelBlobObject,
} from "@/server/storage/r2";

const MAX_BYTES = 10 * 1024 * 1024;

type Ctx = { params: Promise<{ key: string[] }> };

function joinKey(parts: string[]): string {
  return parts.map((p) => decodeURIComponent(p)).join("/");
}

function backendDisabled(): Response {
  return new Response(
    `Storage route is for the local or vercel-blob backends; current backend is "${storageBackend()}".`,
    { status: 503 },
  );
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const local = isLocalStorage();
  const vercelBlob = isVercelBlob();
  if (!local && !vercelBlob) return backendDisabled();

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key: parts } = await ctx.params;
  const key = joinKey(parts);
  const expectedPrefix = `users/${session.user.id}/`;
  if (!key.startsWith(expectedPrefix)) {
    return new Response("Forbidden: key outside your namespace", {
      status: 403,
    });
  }

  const contentType = req.headers.get("content-type") ?? "application/octet-stream";

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await req.arrayBuffer());
  } catch {
    return new Response("Could not read body", { status: 400 });
  }

  try {
    assertUploadableImage(contentType, bytes.byteLength);
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return new Response(err.message, { status: 415 });
    }
    throw err;
  }

  if (bytes.byteLength > MAX_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  if (local) {
    await writeLocalObject(key, bytes);
  } else {
    await writeVercelBlobObject(key, bytes, contentType);
  }
  return new Response(null, { status: 200 });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!isLocalStorage()) return backendDisabled();

  const { key: parts } = await ctx.params;
  const key = joinKey(parts);

  const exists = await objectExists(key);
  if (!exists) {
    return new Response("Not found", { status: 404 });
  }

  const nodeStream = openLocalObjectStream(key);
  const webStream = Readable.toWeb(nodeStream) as NodeReadableStream<Uint8Array>;

  return new Response(webStream as unknown as ReadableStream, {
    headers: {
      "Content-Type": localMimeFromKey(key),
      "Cache-Control": "public, max-age=300",
    },
  });
}
