/**
 * Object storage abstraction. Two backends:
 *
 *   - Cloudflare R2 (S3-compatible) for production / shared dev.
 *   - Local filesystem (./uploads on the dev machine) when
 *     LOVORLD_LOCAL_STORAGE=1. Lets you run the app without R2 credentials.
 *
 * The exported API is identical for both — call sites in posts/actions and
 * posts/analyze don't know which backend is active.
 *
 * Object key convention: `users/{userId}/posts/{postId}/original.{ext}`
 * Keeps everything per-user, which makes lifecycle / bulk delete trivial.
 */
import "server-only";

import { createReadStream } from "node:fs";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { del as blobDel, head as blobHead, put as blobPut } from "@vercel/blob";

import { env, isLocalStorage, isVercelBlob } from "@/lib/env";

const LOCAL_DIR = path.join(process.cwd(), "uploads");

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

let _client: S3Client | undefined;
function r2(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${env.storage.r2.accountId()}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.storage.r2.accessKeyId(),
        secretAccessKey: env.storage.r2.secretAccessKey(),
      },
    });
  }
  return _client;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function assertUploadableImage(mimeType: string, size: number) {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new UploadValidationError(
      `Unsupported image type: ${mimeType}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}.`,
    );
  }
  if (size <= 0 || size > MAX_BYTES) {
    throw new UploadValidationError(`Image size must be 1 byte–${MAX_BYTES} bytes. Got ${size}.`);
  }
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

export function objectKeyFor(params: { userId: string; postId: string; mimeType: string }): string {
  const ext = MIME_TO_EXT[params.mimeType] ?? "bin";
  return `users/${params.userId}/posts/${params.postId}/original.${ext}`;
}

export function publicUrlFor(key: string): string {
  if (isLocalStorage()) {
    return `${appBaseUrl()}/api/storage/${key}`;
  }
  if (isVercelBlob()) {
    const base = (process.env.BLOB_PUBLIC_URL ?? "").replace(/\/$/, "");
    if (!base) {
      throw new Error(
        "BLOB_PUBLIC_URL is not set. After creating a Vercel Blob store, the dashboard shows a URL like https://<store-id>.public.blob.vercel-storage.com — set that as BLOB_PUBLIC_URL.",
      );
    }
    return `${base}/${key}`;
  }
  const base = env.storage.r2.publicUrl().replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function createPresignedPutUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}): Promise<string> {
  if (isLocalStorage() || isVercelBlob()) {
    // Both local and Vercel-blob backends route the client's PUT through our
    // own /api/storage route handler. For local that writes to ./uploads;
    // for Vercel Blob the handler forwards into @vercel/blob's put().
    return `${appBaseUrl()}/api/storage/${params.key}`;
  }
  const command = new PutObjectCommand({
    Bucket: env.storage.r2.bucket(),
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });
  return getSignedUrl(r2(), command, {
    expiresIn: params.expiresInSeconds ?? 600,
  });
}

export async function objectExists(key: string): Promise<boolean> {
  if (isLocalStorage()) {
    try {
      await access(path.join(LOCAL_DIR, key));
      return true;
    } catch {
      return false;
    }
  }
  if (isVercelBlob()) {
    try {
      await blobHead(publicUrlFor(key));
      return true;
    } catch {
      return false;
    }
  }
  try {
    await r2().send(
      new HeadObjectCommand({
        Bucket: env.storage.r2.bucket(),
        Key: key,
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof Error && /not\s*found|notfound/i.test(err.message)) {
      return false;
    }
    if (
      err &&
      typeof err === "object" &&
      "$metadata" in err &&
      typeof (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ===
        "number"
    ) {
      const status = (err as { $metadata: { httpStatusCode: number } }).$metadata.httpStatusCode;
      if (status === 404) return false;
    }
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (isLocalStorage()) {
    await unlink(path.join(LOCAL_DIR, key)).catch(() => {});
    return;
  }
  if (isVercelBlob()) {
    await blobDel(publicUrlFor(key));
    return;
  }
  await r2().send(
    new DeleteObjectCommand({
      Bucket: env.storage.r2.bucket(),
      Key: key,
    }),
  );
}

/**
 * Read the stored object's bytes back. The AI analyze step uses this so we
 * can hand DeepSeek a base64 data URL (works on both backends without
 * exposing local-host URLs to a third-party service).
 */
export async function readObjectBytes(
  key: string,
): Promise<{ data: Uint8Array; mimeType: string }> {
  if (isLocalStorage()) {
    const buf = await readFile(path.join(LOCAL_DIR, key));
    const mime = EXT_TO_MIME[path.extname(key).toLowerCase()] ?? "image/jpeg";
    return { data: new Uint8Array(buf), mimeType: mime };
  }
  if (isVercelBlob()) {
    // Vercel Blob serves uploads on a public URL; just fetch it back.
    const url = publicUrlFor(key);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Vercel Blob fetch failed (${res.status} ${res.statusText}) for ${url}`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const mime =
      res.headers.get("content-type") ??
      EXT_TO_MIME[path.extname(key).toLowerCase()] ??
      "image/jpeg";
    return { data: buf, mimeType: mime };
  }
  const obj = await r2().send(new GetObjectCommand({ Bucket: env.storage.r2.bucket(), Key: key }));
  if (!obj.Body) throw new Error(`Object ${key} has no body.`);
  const buf = await obj.Body.transformToByteArray();
  return { data: buf, mimeType: obj.ContentType ?? "image/jpeg" };
}

// -----------------------------------------------------------------------
// Local-storage-only helpers (used by the /api/storage route handler)
// -----------------------------------------------------------------------

export const LOCAL_STORAGE_DIR = LOCAL_DIR;

export async function writeLocalObject(key: string, bytes: Uint8Array): Promise<void> {
  const filePath = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

/**
 * Vercel Blob upload — used by /api/storage when storageBackend() === "vercel-blob".
 * addRandomSuffix: false keeps the URL predictable so publicUrlFor() works
 * without DB lookup.
 */
export async function writeVercelBlobObject(
  key: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<void> {
  // @vercel/blob accepts Buffer, not raw Uint8Array. Wrap before passing.
  await blobPut(key, Buffer.from(bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType: mimeType,
  });
}

export function openLocalObjectStream(key: string) {
  return createReadStream(path.join(LOCAL_DIR, key));
}

export function localMimeFromKey(key: string): string {
  return EXT_TO_MIME[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}
