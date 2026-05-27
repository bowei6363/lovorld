/**
 * Edge-safe portion of the Auth.js config. Imports nothing that touches
 * the database or any heavy SDK, so the Proxy can use it on every request
 * without bloating the function bundle.
 *
 * The actual provider (Credentials → mint guest) lives in src/auth.ts
 * because its `authorize` callback inserts a `users` row via Drizzle.
 */
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
