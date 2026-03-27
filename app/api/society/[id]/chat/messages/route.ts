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

const POLL_PREFIX = "[POLL]";

type PollPayload = {
  question: string;
  options: string[];
};

function parsePollPayload(content: string): PollPayload | null {
  if (!content.startsWith(POLL_PREFIX)) {
    return null;
  }

  try {
    const payload = JSON.parse(content.slice(POLL_PREFIX.length)) as {
      question?: unknown;
      options?: unknown;
    };

    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    const options = Array.isArray(payload.options)
      ? payload.options
          .filter((option): option is string => typeof option === "string")
          .map((option) => option.trim())
          .filter((option) => option.length > 0)
      : [];

    if (!question || options.length < 2) {
      return null;
    }

    return { question, options };
  } catch {
    return null;
  }
}

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

    const messages = data ?? [];
    const pollMessages = messages
      .map((message) => {
        const payload = parsePollPayload(message.content as string);
        if (!payload) {
          return null;
        }

        return {
          id: Number(message.id),
          optionsCount: payload.options.length,
        };
      })
      .filter((entry): entry is { id: number; optionsCount: number } => Boolean(entry));

    if (pollMessages.length === 0) {
      return NextResponse.json({ success: true, messages }, { status: 200 });
    }

    const pollMessageIds = pollMessages.map((entry) => entry.id);
    const optionCountByMessage = new Map<number, number>(
      pollMessages.map((entry) => [entry.id, entry.optionsCount])
    );

    const { data: voteRows, error: voteError } = await supabase
      .from("community_chat_poll_votes")
      .select("message_id, option_index, user_id")
      .in("message_id", pollMessageIds);

    if (voteError && voteError.code !== "42P01") {
      throw voteError;
    }

    const countsByMessage = new Map<number, number[]>();
    const myVoteByMessage = new Map<number, number>();

    (voteRows ?? []).forEach((vote) => {
      const messageId = Number(vote.message_id);
      const optionCount = optionCountByMessage.get(messageId);
      if (!optionCount) {
        return;
      }

      if (!countsByMessage.has(messageId)) {
        countsByMessage.set(messageId, Array.from({ length: optionCount }, () => 0));
      }

      const counts = countsByMessage.get(messageId)!;
      if (vote.option_index >= 0 && vote.option_index < counts.length) {
        counts[vote.option_index] += 1;
      }

      if (vote.user_id === user.id) {
        myVoteByMessage.set(messageId, vote.option_index);
      }
    });

    const enrichedMessages = messages.map((message) => {
      const messageId = Number(message.id);
      const optionCount = optionCountByMessage.get(messageId);
      if (!optionCount) {
        return message;
      }

      const counts =
        countsByMessage.get(messageId) ?? Array.from({ length: optionCount }, () => 0);

      return {
        ...message,
        poll_vote_counts: counts,
        poll_user_vote_index: myVoteByMessage.get(messageId) ?? null,
      };
    });

    return NextResponse.json({ success: true, messages: enrichedMessages }, { status: 200 });
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
    const pollPayload =
      body.poll && typeof body.poll === "object" ? (body.poll as Record<string, unknown>) : null;
    const pollQuestion =
      pollPayload && typeof pollPayload.question === "string"
        ? pollPayload.question.trim()
        : "";
    const pollOptions =
      pollPayload && Array.isArray(pollPayload.options)
        ? pollPayload.options
            .filter((option): option is string => typeof option === "string")
            .map((option) => option.trim())
            .filter((option) => option.length > 0)
        : [];
    const hasPoll = Boolean(pollQuestion && pollOptions.length >= 2);
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

    if (!content && !normalizedAttachment && !hasPoll) {
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

    if (hasPoll && pollOptions.length > 8) {
      return NextResponse.json(
        { error: "A poll can have at most 8 options" },
        { status: 400 }
      );
    }

    const encodedPollContent = hasPoll
      ? `${POLL_PREFIX}${JSON.stringify({ question: pollQuestion, options: pollOptions })}`
      : "";
    const messageContent = hasPoll ? encodedPollContent : content || "[Attachment]";

    if (messageContent.length > 2000) {
      return NextResponse.json(
        { error: "Poll content is too long" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("community_chat_messages")
      .insert([
        {
          community_id: communityId,
          user_id: user.id,
          content: messageContent,
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

    const pollPayloadFromMessage = parsePollPayload(data.content as string);
    const message = pollPayloadFromMessage
      ? {
          ...data,
          poll_vote_counts: Array.from({ length: pollPayloadFromMessage.options.length }, () => 0),
          poll_user_vote_index: null,
        }
      : data;

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error) {
    console.error("Error sending chat message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
