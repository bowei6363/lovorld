import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signInAsGuest } from "@/server/auth/guest";

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
          <CardTitle className="text-2xl">欢迎来到 lovorld</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            action={async () => {
              "use server";
              await signInAsGuest(callbackUrl);
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              一键体验——无需注册
            </Button>
          </form>
          <p className="text-muted-foreground -mt-1 text-center text-xs">
            会自动为你创建一个临时账号，30 天内有效。上传、点赞、评论、AI
            推荐——所有功能都和正式账号一样。
          </p>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              登录失败，请重试。
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
