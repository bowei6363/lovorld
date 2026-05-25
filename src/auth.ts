import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";

import { db } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema/auth";

import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Database sessions let us track devices and force-logout users — worth the
  // extra DB round-trip for a social app. Switch to "jwt" later if needed.
  session: { strategy: "database" },
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    session({ session, user }) {
      // Surface user.id on the session object; consumed by the DAL.
      session.user.id = user.id;
      return session;
    },
  },
});
