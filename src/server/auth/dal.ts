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
import { isDemoMode } from "@/lib/env";
import { DEMO_SELF_ID, findDemoUser } from "@/server/demo/fixtures";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema/auth";

type SessionPayload = {
  userId: string;
  session: { user: { id: string; name?: string | null; email?: string | null } };
};

export const verifySession = cache(async (): Promise<SessionPayload> => {
  if (isDemoMode()) {
    const u = findDemoUser(DEMO_SELF_ID);
    return {
      userId: DEMO_SELF_ID,
      session: {
        user: { id: DEMO_SELF_ID, name: u?.name ?? null, email: u?.email ?? null },
      },
    };
  }
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  return { userId: session.user.id, session };
});

type ThinUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  handle: string | null;
  bio: string | null;
};

export const getCurrentUser = cache(async (): Promise<ThinUser | null> => {
  if (isDemoMode()) {
    const u = findDemoUser(DEMO_SELF_ID);
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      handle: u.handle,
      bio: u.bio,
    };
  }
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

export const tryGetCurrentUser = cache(async (): Promise<ThinUser | null> => {
  if (isDemoMode()) {
    const u = findDemoUser(DEMO_SELF_ID);
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      handle: u.handle,
      bio: u.bio,
    };
  }
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
