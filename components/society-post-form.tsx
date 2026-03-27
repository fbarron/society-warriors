"use client";

import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card } from "./ui/card";
import { AlertCircle, Loader2, Paperclip } from "lucide-react";
import Image from "next/image";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"] as const;
const MAX_IMAGE_COUNT = 4;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 1920;

type UploadedImageMetadata = {
  url: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  filename: string;
};

type SelectedImage = {
  file: File;
  previewUrl: string;
};

async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.type === "image/gif") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const quality = 0.8;
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, file.type, quality);
  });

  if (!blob) {
    return file;
  }

  const compressed = new File([blob], file.name, {
    type: file.type,
    lastModified: Date.now(),
  });

  return compressed.size < file.size ? compressed : file;
}

interface SocietyPostFormProps {
  communityId: string;
  communityName: string;
  userRole?: "owner" | "admin" | "moderator" | "member";
  onPostCreated?: (post: any) => void;
}

export function SocietyPostForm({
  communityId,
  communityName,
  userRole = "member",
  onPostCreated,
}: SocietyPostFormProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [enlargedPreviewUrl, setEnlargedPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = userRole === "owner" || userRole === "admin";

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const incoming = Array.from(files);
    const totalCount = selectedImages.length + incoming.length;

    if (totalCount > MAX_IMAGE_COUNT) {
      setError(`You can upload up to ${MAX_IMAGE_COUNT} images per post.`);
      return;
    }

    const invalidType = incoming.find((file) => !ALLOWED_IMAGE_TYPES.includes(file.type as any));
    if (invalidType) {
      setError("Only JPG, PNG, and GIF files are supported.");
      return;
    }

    const oversized = incoming.find((file) => file.size > MAX_IMAGE_SIZE_BYTES);
    if (oversized) {
      setError("Each image must be 10MB or smaller.");
      return;
    }

    const withPreviews = incoming.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setError(null);
    setSelectedImages((prev) => [...prev, ...withPreviews]);

    event.target.value = "";
  };

  const removeImage = (previewUrl: string) => {
    setSelectedImages((prev) => {
      const toRemove = prev.find((entry) => entry.previewUrl === previewUrl);
      if (toRemove) {
        URL.revokeObjectURL(toRemove.previewUrl);
      }

      return prev.filter((entry) => entry.previewUrl !== previewUrl);
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const imageMetadata: UploadedImageMetadata[] = [];

      for (const selected of selectedImages) {
        const compressedFile = await compressImageIfNeeded(selected.file);
        const uploadForm = new FormData();
        uploadForm.append("image", compressedFile);
        uploadForm.append("communityId", communityId);

        const uploadResponse = await fetch("/api/society/posts/upload-image", {
          method: "POST",
          body: uploadForm,
        });

        if (!uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          throw new Error(uploadData.error || "Failed to upload image");
        }

        const uploadData = await uploadResponse.json();
        imageMetadata.push(uploadData.image as UploadedImageMetadata);
      }

      const response = await fetch("/api/society/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId,
          content: content.trim(),
          imageMetadata,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create post");
      }

      const data = await response.json();
      setContent("");
      selectedImages.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
      setSelectedImages([]);

      if (onPostCreated) {
        onPostCreated(data.post);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 mb-6">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Post to {communityName}
          </label>
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="resize-none"
            rows={3}
            disabled={loading}
          />
        </div>

        <div className="mb-4">
          <input
            id="post-images"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            multiple
            onChange={handleImageSelection}
            disabled={loading}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || selectedImages.length >= MAX_IMAGE_COUNT}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Attach images"
          >
            <Paperclip className="h-4 w-4" />
            <span>
              Attach images {selectedImages.length > 0 ? `(${selectedImages.length}/${MAX_IMAGE_COUNT})` : ""}
            </span>
          </button>
          <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, GIF. Max 10MB each.</p>
        </div>

        {selectedImages.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {selectedImages.map((entry) => (
              <div key={entry.previewUrl} className="relative overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => setEnlargedPreviewUrl(entry.previewUrl)}
                  className="block w-full"
                  aria-label={`Open preview for ${entry.file.name}`}
                >
                  <Image
                    src={entry.previewUrl}
                    alt={entry.file.name}
                    width={200}
                    height={200}
                    className="h-28 w-full object-cover"
                    unoptimized
                  />
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(entry.previewUrl)}
                  className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs text-white"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {enlargedPreviewUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setEnlargedPreviewUrl(null)}
          >
            <div
              className="relative w-full max-w-5xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-2 top-2 z-10 rounded bg-black/70 px-3 py-1 text-sm text-white"
                onClick={() => setEnlargedPreviewUrl(null)}
              >
                Close
              </button>
              <Image
                src={enlargedPreviewUrl}
                alt="Expanded preview"
                width={1600}
                height={1200}
                className="h-auto max-h-[85vh] w-full rounded-lg object-contain"
                unoptimized
              />
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Your post will be reviewed by community admins before appearing
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={!content.trim() || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            isAdmin ? "Publish Post" : "Submit for Review"
          )}
        </Button>
      </form>
    </Card>
  );
}
