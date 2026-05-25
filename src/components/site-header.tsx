import Link from "next/link";

import { tryGetCurrentUser } from "@/server/auth/dal";
import { toPublicProfile } from "@/server/auth/dto";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const me = await tryGetCurrentUser();

  return (
    <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="font-semibold tracking-tight">
          lovorld
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {me ? (
            <>
              <Button render={<Link href="/feed" />} variant="ghost" size="sm">
                Feed
              </Button>
              <Button render={<Link href="/upload" />} variant="ghost" size="sm">
                Upload
              </Button>
              <UserMenu user={toPublicProfile(me)} />
            </>
          ) : (
            <Button render={<Link href="/sign-in" />} size="sm">
              Sign in
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
