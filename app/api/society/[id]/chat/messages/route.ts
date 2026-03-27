import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MAX_MESSAGES_PER_REQUEST = 100;

type ChatAttachment = {
  url: string;
  path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

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

export async function GET(
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
        { error: "Only active community members can access chat" },
        { status: 403 }
      );
    }

    const limitParam = Number(request.nextUrl.searchParams.get("limit") || "100");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), MAX_MESSAGES_PER_REQUEST)
      : 100;

    const { data, error } = await supabase
      .from("community_chat_messages")
      .select(
        `
        id,
        content,
        attachment_url,
        attachment_path,
        attachment_file_name,
        attachment_mime_type,
        attachment_size_bytes,
        created_at,
        user_id,
        user:users(id, name, avatar_url)
      `
      )
      .eq("community_id", communityId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, messages: data ?? [] }, { status: 200 });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat messages" },
      { status: 500 }
    );
  }
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
        { error: "Only active community members can send messages" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const attachment = body.attachment as ChatAttachment | undefined;
    const normalizedAttachment =
      attachment &&
      typeof attachment.url === "string" &&
      typeof attachment.path === "string" &&
      typeof attachment.file_name === "string" &&
      typeof attachment.mime_type === "string" &&
      typeof attachment.size_bytes === "number"
        ? attachment
        : null;

    if (!content && !normalizedAttachment) {
      return NextResponse.json(
        { error: "Message content or attachment is required" },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Message must be 2000 characters or fewer" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("community_chat_messages")
      .insert([
        {
          community_id: communityId,
          user_id: user.id,
          content: content || "[Attachment]",
          attachment_url: normalizedAttachment?.url ?? null,
          attachment_path: normalizedAttachment?.path ?? null,
          attachment_file_name: normalizedAttachment?.file_name ?? null,
          attachment_mime_type: normalizedAttachment?.mime_type ?? null,
          attachment_size_bytes: normalizedAttachment?.size_bytes ?? null,
        },
      ])
      .select(
        `
        id,
        content,
        attachment_url,
        attachment_path,
        attachment_file_name,
        attachment_mime_type,
        attachment_size_bytes,
        created_at,
        user_id,
        user:users(id, name, avatar_url)
      `
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: data }, { status: 201 });
  } catch (error) {
    console.error("Error sending chat message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
