import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signInAsGuest } from "@/server/auth/guest";

const ENABLED_PROVIDERS = (
  [
    {
      id: "github",
      label: "Continue with GitHub",
      enabled: !!process.env.AUTH_GITHUB_ID,
    },
    {
      id: "google",
      label: "Continue with Google",
      enabled: !!process.env.AUTH_GOOGLE_ID,
    },
  ] as const
).filter((p) => p.enabled);

type Props = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  if (session?.user) redirect(callbackUrl ?? "/feed");

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in to lovorld</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Guest entry first — this is the seed-user fast path. */}
          <form
            action={async () => {
              "use server";
              await signInAsGuest(callbackUrl);
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Quick try — no signup needed
            </Button>
          </form>
          <p className="text-muted-foreground -mt-1 text-center text-xs">
            Mints a guest account that lasts 30 days. You can keep using it or link it to GitHub
            later.
          </p>

          {ENABLED_PROVIDERS.length > 0 ? (
            <>
              <div className="my-2 flex items-center gap-3">
                <div className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs tracking-widest uppercase">or</span>
                <div className="bg-border h-px flex-1" />
              </div>

              {ENABLED_PROVIDERS.map((provider) => (
                <form
                  key={provider.id}
                  action={async () => {
                    "use server";
                    await signIn(provider.id, {
                      redirectTo: callbackUrl ?? "/feed",
                    });
                  }}
                >
                  <Button type="submit" variant="outline" className="w-full" size="lg">
                    {provider.label}
                  </Button>
                </form>
              ))}
            </>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error === "OAuthAccountNotLinked"
                ? "That account is linked to another sign-in method. Try the one you used originally."
                : "Sign-in failed. Please try again."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
