import { redirect } from "next/navigation";

import { signIn, auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          {ENABLED_PROVIDERS.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No OAuth providers are configured. Set{" "}
              <code className="bg-muted rounded px-1">AUTH_GITHUB_ID</code> or{" "}
              <code className="bg-muted rounded px-1">AUTH_GOOGLE_ID</code> in{" "}
              <code className="bg-muted rounded px-1">.env.local</code> to enable sign-in.
            </p>
          ) : (
            ENABLED_PROVIDERS.map((provider) => (
              <form
                key={provider.id}
                action={async () => {
                  "use server";
                  await signIn(provider.id, {
                    redirectTo: callbackUrl ?? "/feed",
                  });
                }}
              >
                <Button type="submit" className="w-full" size="lg">
                  {provider.label}
                </Button>
              </form>
            ))
          )}

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
