/**
 * Best-effort in-memory token bucket rate limit. Lives in module scope so it
 * survives across requests within a single Node process; in a clustered or
 * serverless deployment each instance has its own bucket — that is fine for
 * an abuse speed-bump but NOT a security boundary. Swap in Redis (Upstash)
 * once we deploy beyond a single instance.
 */
import "server-only";

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Maximum tokens the bucket holds. Burst size. */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
};

function consume(key: string, opts: RateLimitOptions): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: opts.capacity, updatedAt: now };
    buckets.set(key, b);
  }
  const elapsedSeconds = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(opts.capacity, b.tokens + elapsedSeconds * opts.refillPerSecond);
  b.updatedAt = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

export class RateLimitError extends Error {
  constructor(message = "Too many requests. Please slow down.") {
    super(message);
    this.name = "RateLimitError";
  }
}

export function requireRateLimit(key: string, opts: RateLimitOptions): void {
  if (!consume(key, opts)) {
    throw new RateLimitError();
  }
}

/** Common preset: a single user mutating their own data. */
export const USER_WRITE_LIMIT: RateLimitOptions = {
  capacity: 12, // burst of 12
  refillPerSecond: 0.2, // 1 every 5s steady-state
};

/** Tighter preset for AI/upload-triggering actions (cost money). */
export const USER_UPLOAD_LIMIT: RateLimitOptions = {
  capacity: 4,
  refillPerSecond: 0.05, // 1 every 20s
};
