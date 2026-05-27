import { UploadForm } from "@/components/upload-form";

export default function UploadPage() {
  return (
    <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">分享一张你喜爱的图片</h1>
        <p className="text-muted-foreground">
          挑一张打动你的图。AI 会读懂它的视觉特质，帮你找到品味相通的人。
        </p>
      </header>

      <UploadForm />
    </section>
  );
}
