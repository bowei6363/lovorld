import Link from "next/link";

import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { tryGetCurrentUser } from "@/server/auth/dal";
import { toPublicProfile } from "@/server/auth/dto";
import { countUnreadMessages } from "@/server/messages/queries";
import { countUnreadNotifications } from "@/server/social/queries";

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="bg-primary text-primary-foreground ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] leading-none font-semibold">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export async function SiteHeader() {
  const me = await tryGetCurrentUser();
  const [unread, unreadMsg] = me
    ? await Promise.all([countUnreadNotifications(me.id), countUnreadMessages(me.id)])
    : [0, 0];

  return (
    <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="font-semibold tracking-tight">
          lovorld
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {me ? (
            <>
              <Button render={<Link href="/feed" />} variant="ghost" size="sm">
                信息流
              </Button>
              <Button render={<Link href="/upload" />} variant="ghost" size="sm">
                上传
              </Button>
              <Button
                render={<Link href="/messages" />}
                variant="ghost"
                size="sm"
                className="relative"
              >
                私信
                <Badge n={unreadMsg} />
              </Button>
              <Button
                render={<Link href="/notifications" />}
                variant="ghost"
                size="sm"
                className="relative"
              >
                通知
                <Badge n={unread} />
              </Button>
              <UserMenu user={toPublicProfile(me)} />
            </>
          ) : (
            <Button render={<Link href="/sign-in" />} size="sm">
              登录
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
