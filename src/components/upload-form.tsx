"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createUploadIntent, finalizePost } from "@/server/posts/actions";

const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => reject(new Error("Could not read image dimensions."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(picked: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!picked) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    if (!picked.type.startsWith("image/")) {
      toast.error("That doesn't look like an image.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error(`Too large — ${formatBytes(picked.size)}. Max ${formatBytes(MAX_BYTES)}.`);
      return;
    }

    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || pending) return;

    startTransition(async () => {
      try {
        const intent = await createUploadIntent({
          mimeType: file.type,
          byteSize: file.size,
        });

        const dimsPromise = readImageDimensions(file);

        const putRes = await fetch(intent.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Upload to storage failed (${putRes.status} ${putRes.statusText}).`);
        }

        const dims = await dimsPromise;

        await finalizePost({
          postId: intent.postId,
          r2Key: intent.r2Key,
          mimeType: file.type,
          byteSize: file.size,
          width: dims.width,
          height: dims.height,
          caption: caption.trim() || undefined,
        });

        toast.success("Shared! Analysis is running in the background.");
        router.push("/feed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <Card>
        <CardContent className="space-y-4 py-6">
          <label
            htmlFor="upload-file"
            className={cn(
              "group/dropzone bg-muted/30 hover:bg-muted/50 flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed transition",
              previewUrl && "border-solid bg-transparent hover:bg-transparent",
            )}
          >
            <input
              id="upload-file"
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Selected upload preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="text-muted-foreground space-y-1 text-center text-sm">
                <p className="font-medium">Click to choose an image</p>
                <p className="text-xs">
                  JPG, PNG, WebP, AVIF, or GIF — up to {formatBytes(MAX_BYTES)}.
                </p>
              </div>
            )}
          </label>

          {file ? (
            <p className="text-muted-foreground text-xs">
              {file.name} · {formatBytes(file.size)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <label htmlFor="caption" className="text-sm font-medium">
          Caption (optional)
        </label>
        <Input
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="A word about why you love it…"
          maxLength={500}
          disabled={pending}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            pickFile(null);
            setCaption("");
            if (inputRef.current) inputRef.current.value = "";
          }}
          disabled={pending || !file}
        >
          Reset
        </Button>
        <Button type="submit" disabled={pending || !file}>
          {pending ? "Sharing…" : "Share"}
        </Button>
      </div>
    </form>
  );
}
