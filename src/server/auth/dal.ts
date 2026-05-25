/**
 * Data Access Layer for authenticated requests, per the Next 16
 * authentication guide. All authorized data reads should go through here so
 * the auth check sits next to the data — keeps secure boundary in one place.
 *
 * `cache()` memoizes within a single React render pass, so calling
 * verifySession() / getCurrentUser() multiple times in one request still
 * performs at most one DB round-trip.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema/auth";

export const verifySession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  return { userId: session.user.id, session };
});

export const getCurrentUser = cache(async () => {
  const { userId } = await verifySession();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      handle: users.handle,
      bio: users.bio,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] ?? null;
});

/** Soft variant: does not redirect; returns null when unauthenticated. */
export const tryGetCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      handle: users.handle,
      bio: users.bio,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return rows[0] ?? null;
});
