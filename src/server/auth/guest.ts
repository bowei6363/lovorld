"use server";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema/auth";

/**
 * Guest sign-in: skip OAuth entirely and mint an anonymous account on the
 * spot. Used for seed-user testing where you want to invite people to try
 * the product without forcing them through GitHub authorization.
 *
 * Mechanics: we write a new user + Auth.js session row directly, then set
 * the same session cookie Auth.js looks at. The DAL / Proxy / UserMenu can't
 * tell the resulting session apart from a real OAuth one.
 *
 * Trade-offs:
 *   - Guests have a randomized handle/name they can edit later.
 *   - Email is a fake @guest.lovorld.local address — uniqueness only.
 *   - Session lives 30 days. After that, the row expires and they're
 *     prompted to sign in (or quick-try again to start fresh).
 *   - No spam protection here. If guest abuse becomes a problem, add a
 *     turnstile / hCaptcha gate on this action.
 */

const SESSION_DAYS = 30;

function cookieName(): string {
  // Auth.js uses different cookie names depending on the deployment scheme.
  // We mirror its defaults so the same code path reads/writes the same key.
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

function shortId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

export async function signInAsGuest(callbackUrl?: string): Promise<never> {
  const userId = randomUUID();
  const handle = `guest-${shortId()}`;
  const name = `Guest ${handle.slice(6).toUpperCase()}`;
  const email = `${handle}@guest.lovorld.local`;

  await db.insert(users).values({
    id: userId,
    name,
    handle,
    email,
    bio: "Trying lovorld as a guest.",
  });

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    sessionToken,
    userId,
    expires,
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
    secure: process.env.NODE_ENV === "production",
  });

  redirect(callbackUrl ?? "/feed");
}
