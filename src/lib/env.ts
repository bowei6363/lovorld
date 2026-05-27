/**
 * Centralized typed access to environment variables.
 *
 * Throws at first use if a required var is missing — fail fast in dev/CI
 * rather than surfacing a confusing runtime error later. Public vars
 * (NEXT_PUBLIC_*) are inlined by Next at build time and safe on the client;
 * everything else must only be read in server contexts.
 */

/**
 * Demo mode: when LOVORLD_DEMO_MODE=1, every data-access function returns
 * static fixtures and writes are no-ops. Lets reviewers click through the
 * UI without provisioning Postgres / OAuth / R2 / AI keys.
 */
export function isDemoMode(): boolean {
  return process.env.LOVORLD_DEMO_MODE === "1";
}

/**
 * Storage backend selection. Auto-detects based on env:
 *   - "local"        when LOVORLD_LOCAL_STORAGE=1 (dev only)
 *   - "vercel-blob"  when BLOB_READ_WRITE_TOKEN is set (Vercel auto-injects)
 *   - "r2"           otherwise (Cloudflare R2 via S3 SDK)
 */
export type StorageBackend = "local" | "vercel-blob" | "r2";

export function storageBackend(): StorageBackend {
  if (process.env.LOVORLD_LOCAL_STORAGE === "1") return "local";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  return "r2";
}

export function isLocalStorage(): boolean {
  return storageBackend() === "local";
}

export function isVercelBlob(): boolean {
  return storageBackend() === "vercel-blob";
}

function required(name: string): string {
  const value = process.env[name];
  if (value) return value;

  // `next build` collects page data by initializing every route module, which
  // pulls in the db client + AuthJS handlers even though the routes are never
  // invoked. Allow placeholders during the build phase so CI can produce an
  // artifact without prod secrets; real requests still fail loudly.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return `placeholder://${name.toLowerCase()}`;
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  app: {
    publicUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },
  db: {
    url: () => required("DATABASE_URL"),
  },
  auth: {
    secret: () => required("AUTH_SECRET"),
    google: {
      id: () => optional("AUTH_GOOGLE_ID"),
      secret: () => optional("AUTH_GOOGLE_SECRET"),
    },
    github: {
      id: () => optional("AUTH_GITHUB_ID"),
      secret: () => optional("AUTH_GITHUB_SECRET"),
    },
  },
  storage: {
    r2: {
      accountId: () => required("R2_ACCOUNT_ID"),
      accessKeyId: () => required("R2_ACCESS_KEY_ID"),
      secretAccessKey: () => required("R2_SECRET_ACCESS_KEY"),
      bucket: () => process.env.R2_BUCKET ?? "lovorld-images",
      publicUrl: () => required("R2_PUBLIC_URL"),
    },
  },
  ai: {
    // Generic OpenAI-compatible vision provider. Defaults to Alibaba's
    // DashScope (qwen-vl-max), but any provider that speaks the
    // chat/completions wire format works — just swap VISION_BASE_URL and
    // VISION_MODEL: OpenAI, Anthropic-via-proxy, Zhipu, Moonshot, etc.
    vision: {
      baseUrl: () =>
        (
          process.env.VISION_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
        ).replace(/\/$/, ""),
      apiKey: () => required("VISION_API_KEY"),
      model: () => process.env.VISION_MODEL ?? "qwen-vl-max",
    },
    // Generic OpenAI-compatible embedding provider. Must produce 1024-d
    // vectors to match the schema. DashScope text-embedding-v3 supports
    // `dimensions: 1024`; OpenAI text-embedding-3-large supports the same.
    embedding: {
      baseUrl: () =>
        (
          process.env.EMBEDDING_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
        ).replace(/\/$/, ""),
      apiKey: () => required("EMBEDDING_API_KEY"),
      model: () => process.env.EMBEDDING_MODEL ?? "text-embedding-v3",
    },
  },
  monitoring: {
    sentryDsn: () => optional("SENTRY_DSN"),
  },
} as const;
