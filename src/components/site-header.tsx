import Link from "next/link";

import { tryGetCurrentUser } from "@/server/auth/dal";
import { toPublicProfile } from "@/server/auth/dto";
import { countUnreadNotifications } from "@/server/social/queries";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const me = await tryGetCurrentUser();
  const unread = me ? await countUnreadNotifications(me.id) : 0;

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
              <Button
                render={<Link href="/notifications" />}
                variant="ghost"
                size="sm"
                className="relative"
              >
                Notifications
                {unread > 0 ? (
                  <span className="bg-primary text-primary-foreground ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] leading-none font-semibold">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
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
