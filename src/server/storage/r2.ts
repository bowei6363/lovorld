/**
 * Cloudflare R2 client + presigned URL helpers.
 *
 * R2 is S3-compatible, so we use the AWS SDK against R2's endpoint. Clients
 * upload directly to R2 with a presigned PUT URL — the application server
 * never proxies image bytes, which keeps it cheap and stateless.
 *
 * Object key convention: `users/{userId}/posts/{postId}/original.{ext}`
 * Keeps everything per-user, which makes lifecycle / bulk delete trivial.
 */
import "server-only";

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

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

export function objectKeyFor(params: { userId: string; postId: string; mimeType: string }): string {
  const ext = MIME_TO_EXT[params.mimeType] ?? "bin";
  return `users/${params.userId}/posts/${params.postId}/original.${ext}`;
}

export function publicUrlFor(key: string): string {
  const base = env.storage.r2.publicUrl().replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function createPresignedPutUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}): Promise<string> {
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
  try {
    await r2().send(
      new HeadObjectCommand({
        Bucket: env.storage.r2.bucket(),
        Key: key,
      }),
    );
    return true;
  } catch (err) {
    // S3 SDK throws on 404; treat any error as "not present" rather than
    // leaking AWS-specific error types up the stack.
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
  await r2().send(
    new DeleteObjectCommand({
      Bucket: env.storage.r2.bucket(),
      Key: key,
    }),
  );
}
