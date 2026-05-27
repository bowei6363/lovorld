"use client";

import Link from "next/link";
import { useTransition } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/server/auth/actions";
import type { PublicProfile } from "@/server/auth/dto";

function initialsOf(name: string | null, fallback: string) {
  const source = name ?? fallback;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({ user }: { user: PublicProfile }) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="打开账号菜单" />
        }
      >
        <Avatar className="size-8">
          {user.image ? <AvatarImage src={user.image} alt={user.name ?? "头像"} /> : null}
          <AvatarFallback>{initialsOf(user.name, user.id)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="truncate">
          {user.handle ? `@${user.handle}` : (user.name ?? "已登录")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>我的主页</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/feed" />}>信息流</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={() => startTransition(() => signOutAction())}>
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
