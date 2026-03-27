import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"] as const;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DetectedImageType = {
  mimeType: "image/jpeg" | "image/png" | "image/gif";
  extension: "jpg" | "png" | "gif";
};

function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) {
    return { mimeType: "image/png", extension: "png" };
  }

  const isGif87a =
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    bytes[4] === 0x37 &&
    bytes[5] === 0x61;
  const isGif89a =
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    bytes[4] === 0x39 &&
    bytes[5] === 0x61;

  if (isGif87a || isGif89a) {
    return { mimeType: "image/gif", extension: "gif" };
  }

  return null;
}

function sanitizeFilename(name: string) {
  const sanitized = name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return sanitized || "image";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image");
    const communityId = String(formData.get("communityId") ?? "").trim();

    if (!communityId) {
      return NextResponse.json(
        { error: "Community ID is required" },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(communityId)) {
      return NextResponse.json(
        { error: "Invalid community ID format" },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, and GIF files are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 10MB or smaller" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detectedType = detectImageType(bytes);

    if (!detectedType) {
      return NextResponse.json(
        { error: "Invalid image file content" },
        { status: 400 }
      );
    }

    if (detectedType.mimeType !== file.type) {
      return NextResponse.json(
        { error: "File content does not match its MIME type" },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from("community_memberships")
      .select("user_id")
      .eq("community_id", communityId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "You must be an active member of this society to upload images" },
        { status: 403 }
      );
    }

    const safeBaseName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
    const path = `${user.id}/${communityId}/${Date.now()}-${crypto.randomUUID()}-${safeBaseName}.${detectedType.extension}`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: detectedType.mimeType,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("post-images").getPublicUrl(path);

    return NextResponse.json(
      {
        success: true,
        image: {
          url: publicUrl,
          path,
          mime_type: detectedType.mimeType,
          size_bytes: file.size,
          filename: sanitizeFilename(file.name),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading post image:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
