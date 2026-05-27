/**
 * Next.js 16 Proxy (formerly middleware). Runs on every matched request and
 * performs OPTIMISTIC auth checks only — secure checks live in the DAL and in
 * Server Actions. We deliberately import the edge-safe `auth.config` so this
 * file stays lightweight even though Proxy runs on Node.js in Next 16.
 *
 * In demo mode (LOVORLD_DEMO_MODE=1) we skip the redirect so reviewers can
 * click through the whole UI without signing in.
 */
import NextAuth from "next-auth";

import authConfig from "./auth.config";

const { auth: proxy } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ["/profile", "/upload", "/feed", "/notifications"];

const DEMO_MODE = process.env.LOVORLD_DEMO_MODE === "1";

export default proxy((req) => {
  if (DEMO_MODE) return;

  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  const isLoggedIn = !!req.auth?.user;

  if (isProtected && !isLoggedIn) {
    const signInUrl = new URL("/sign-in", req.nextUrl);
    signInUrl.searchParams.set("callbackUrl", path);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
