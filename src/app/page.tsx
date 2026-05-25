import Link from "next/link";

import { Button } from "@/components/ui/button";
import { tryGetCurrentUser } from "@/server/auth/dal";

export default async function HomePage() {
  const me = await tryGetCurrentUser();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center">
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
          lovorld
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Share an image you love. Find people who love it too.
        </h1>
        <p className="text-muted-foreground text-lg text-balance">
          Every image you upload is analyzed by AI for its visual essence — style, palette, mood —
          and matched against everyone else&apos;s taste. Social, by what you find beautiful.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {me ? (
          <Button render={<Link href="/feed" />} size="lg">
            Open your feed
          </Button>
        ) : (
          <Button render={<Link href="/sign-in" />} size="lg">
            Get started
          </Button>
        )}
        <Button render={<Link href={me ? "/profile" : "/"} />} size="lg" variant="outline">
          {me ? "My profile" : "Learn more"}
        </Button>
      </div>
    </section>
  );
}
