/**
 * Next.js calls `register()` once per server process startup. We use it as
 * a thin hook to wire up monitoring. Sentry is included as a stub: we don't
 * install @sentry/nextjs by default to keep the install lean, but the env
 * var is honored and a clear log line tells the operator what to do.
 *
 * To actually enable Sentry:
 *   1. npm install @sentry/nextjs
 *   2. Replace the stub block below with the SDK's recommended init() call.
 */
export async function register() {
  if (process.env.SENTRY_DSN) {
    console.log(
      "[lovorld] SENTRY_DSN is set. To send events, install @sentry/nextjs and wire Sentry.init() in src/instrumentation.ts.",
    );
  }
}
