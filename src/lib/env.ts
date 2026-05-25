/**
 * Centralized typed access to environment variables.
 *
 * Throws at first use if a required var is missing — fail fast in dev/CI
 * rather than surfacing a confusing runtime error later. Public vars
 * (NEXT_PUBLIC_*) are inlined by Next at build time and safe on the client;
 * everything else must only be read in server contexts.
 */

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
    deepseek: {
      apiKey: () => required("DEEPSEEK_API_KEY"),
      visionModel: () => process.env.DEEPSEEK_VISION_MODEL ?? "deepseek-vl2",
    },
    voyage: {
      apiKey: () => optional("VOYAGE_API_KEY"),
      model: () => process.env.VOYAGE_EMBED_MODEL ?? "voyage-3-large",
    },
    openai: {
      apiKey: () => optional("OPENAI_API_KEY"),
      embedModel: () => process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-large",
    },
  },
  monitoring: {
    sentryDsn: () => optional("SENTRY_DSN"),
  },
} as const;
