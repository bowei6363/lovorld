import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding-form";
import { getCurrentUser } from "@/server/auth/dal";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");

  return (
    <section className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">欢迎，先花 30 秒</h1>
        <p className="text-muted-foreground">
          告诉我们一点你的审美偏好，lovorld 就能立刻为你推荐同频的人。
        </p>
      </header>

      <OnboardingForm defaultName={me.name ?? ""} />
    </section>
  );
}
