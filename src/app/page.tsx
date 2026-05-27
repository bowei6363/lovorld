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
          分享你喜爱的图片，遇见和你审美相通的人。
        </h1>
        <p className="text-muted-foreground text-lg text-balance">
          你上传的每张图片都会被 AI
          读懂它的视觉特质——风格、调色、情绪——再去和大家的品味做匹配。社交，从你眼中的「美」开始。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {me ? (
          <Button render={<Link href="/feed" />} size="lg">
            打开我的信息流
          </Button>
        ) : (
          <Button render={<Link href="/sign-in" />} size="lg">
            立即体验
          </Button>
        )}
        <Button render={<Link href={me ? "/profile" : "/"} />} size="lg" variant="outline">
          {me ? "我的主页" : "了解更多"}
        </Button>
      </div>
    </section>
  );
}
