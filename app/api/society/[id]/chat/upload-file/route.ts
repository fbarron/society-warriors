import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
] as const;

async function assertActiveMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  communityId: string
) {
  const { data: membership } = await supabase
    .from("community_memberships")
    .select("user_id")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return Boolean(membership);
}

function sanitizeFilename(name: string) {
  const sanitized = name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return sanitized || "file";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communityId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isMember = await assertActiveMembership(supabase, user.id, communityId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Only active community members can upload files" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        { error: "Allowed file types: PDF, TXT, JPG, PNG, GIF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File must be 2MB or smaller" },
        { status: 400 }
      );
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const safeName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
    const path = `${communityId}/${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-files")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-files").getPublicUrl(path);

    return NextResponse.json(
      {
        success: true,
        attachment: {
          url: publicUrl,
          path,
          file_name: sanitizeFilename(file.name),
          mime_type: file.type,
          size_bytes: file.size,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading chat file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
