import { randomUUID } from "node:crypto";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/server/db/client";
import { users } from "@/server/db/schema/auth";

import authConfig from "./auth.config";

function shortId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Lovorld currently has exactly one sign-in path: anonymous guest accounts.
 * The Credentials provider mints a new `users` row each time the button is
 * pressed and hands Auth.js a freshly-shaped user object; from there
 * Auth.js encodes a JWT into a session cookie that both the Proxy and the
 * DAL can decode without a DB lookup.
 *
 * Real OAuth providers (GitHub / Google) used to live alongside this one
 * but were removed when we decided guest-only signup was enough for the
 * seed-user phase. Plug them back in by adding more entries to `providers`
 * — JWT session strategy works with both Credentials and OAuth in parallel.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "guest",
      name: "Guest",
      // No fields — pressing the Quick-try button is the credential.
      credentials: {},
      authorize: async () => {
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

        return { id: userId, name, email };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
