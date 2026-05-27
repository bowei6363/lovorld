"use server";

import { signIn } from "@/auth";

/**
 * One-click guest sign-in. Delegates to Auth.js's Credentials flow which
 * runs `authorize()` in src/auth.ts: that callback inserts a new `users`
 * row and returns the freshly-minted user. Auth.js then encodes the user
 * into a JWT session cookie via its standard machinery, so the Proxy and
 * the DAL can read it without us reinventing cookie signing.
 *
 * Renamed from a manual cookie-mint implementation that produced a plain
 * UUID and tripped JWTSessionError on every request in production.
 */
export async function signInAsGuest(callbackUrl?: string): Promise<never> {
  await signIn("guest", {
    redirect: true,
    redirectTo: callbackUrl ?? "/feed",
  });
  // `signIn(..., { redirect: true })` throws a NEXT_REDIRECT — control
  // never reaches this point. Returning `never` keeps callers honest.
  throw new Error("signIn did not redirect — Auth.js bug?");
}
