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
      img.onerror = () => reject(new Error("无法读取图片尺寸。"));
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
      toast.error("这不是图片文件。");
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error(`图片太大 —— ${formatBytes(picked.size)}，上限 ${formatBytes(MAX_BYTES)}。`);
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
          throw new Error(`上传到云端失败（${putRes.status} ${putRes.statusText}）。`);
        }

        const dims = await dimsPromise;

        const { postId } = await finalizePost({
          postId: intent.postId,
          r2Key: intent.r2Key,
          mimeType: file.type,
          byteSize: file.size,
          width: dims.width,
          height: dims.height,
          caption: caption.trim() || undefined,
        });

        toast.success("已发布！AI 正在后台分析…");
        // Take the user straight to the detail page so they immediately see
        // the image + the AI description as soon as analysis lands. The feed
        // hides own posts on purpose, so jumping there would feel empty.
        router.push(`/p/${postId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "上传失败。");
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
                alt="待上传的图片预览"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="text-muted-foreground space-y-1 text-center text-sm">
                <p className="font-medium">点击选择图片</p>
                <p className="text-xs">
                  支持 JPG、PNG、WebP、AVIF、GIF —— 最大 {formatBytes(MAX_BYTES)}。
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
          说点什么（可选）
        </label>
        <Input
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="你为什么喜欢这张图…"
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
          重置
        </Button>
        <Button type="submit" disabled={pending || !file}>
          {pending ? "发布中…" : "发布"}
        </Button>
      </div>
    </form>
  );
}
