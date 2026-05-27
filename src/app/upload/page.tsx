import { UploadForm } from "@/components/upload-form";

// Proxy already redirects unauthenticated visitors to /sign-in; rendering
// reaches here only when a session exists.
export default function UploadPage() {
  return (
    <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Share an image</h1>
        <p className="text-muted-foreground">
          Pick something you love. Our AI will read its visual essence and surface it to people
          whose taste rhymes with yours.
        </p>
      </header>

      <UploadForm />
    </section>
  );
}
