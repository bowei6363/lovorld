/**
 * Edge-safe portion of the Auth.js config. Anything that needs the database
 * (adapter, session callbacks that query users) lives in src/auth.ts instead.
 * This split lets the Proxy/middleware import auth state without pulling in
 * the postgres driver, which would break under the Edge runtime.
 */
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

export default {
  providers: [
    // Provider env (AUTH_GITHUB_ID / AUTH_GITHUB_SECRET, AUTH_GOOGLE_ID /
    // AUTH_GOOGLE_SECRET) is picked up by Auth.js automatically. Leave them
    // unset to disable a provider locally without a code change.
    GitHub,
    Google,
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth }) {
      // Returning a boolean here drives the optimistic check used by the
      // Proxy. Route-level secure checks happen separately in the DAL.
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
