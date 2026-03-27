import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

function buildCounts(optionCount: number, votes: Array<{ option_index: number }>) {
  const counts = Array.from({ length: optionCount }, () => 0);
  votes.forEach((vote) => {
    if (vote.option_index >= 0 && vote.option_index < optionCount) {
      counts[vote.option_index] += 1;
    }
  });

  return counts;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id: communityId, messageId: messageIdRaw } = await params;
    const messageId = Number(messageIdRaw);

    if (!Number.isFinite(messageId)) {
      return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
    }

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
        { error: "Only active community members can vote in polls" },
        { status: 403 }
      );
    }

    const { data: message, error: messageError } = await supabase
      .from("community_chat_messages")
      .select("id, content, community_id")
      .eq("id", messageId)
      .eq("community_id", communityId)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: "Poll message not found" }, { status: 404 });
    }

    const pollPayload = parsePollPayload(message.content as string);
    if (!pollPayload) {
      return NextResponse.json({ error: "Message is not a poll" }, { status: 400 });
    }

    const body = await request.json();
    const optionIndex = Number(body.optionIndex);

    if (!Number.isFinite(optionIndex) || optionIndex < 0 || optionIndex >= pollPayload.options.length) {
      return NextResponse.json({ error: "Invalid poll option" }, { status: 400 });
    }

    const { data: existingVote } = await supabase
      .from("community_chat_poll_votes")
      .select("option_index")
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .maybeSingle();

    let myVoteIndex: number | null = optionIndex;

    if (existingVote && existingVote.option_index === optionIndex) {
      const { error: deleteError } = await supabase
        .from("community_chat_poll_votes")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      myVoteIndex = null;
    } else {
      const { error: upsertError } = await supabase
        .from("community_chat_poll_votes")
        .upsert(
          {
            community_id: communityId,
            message_id: messageId,
            user_id: user.id,
            option_index: optionIndex,
          },
          { onConflict: "message_id,user_id" }
        );

      if (upsertError) {
        throw upsertError;
      }
    }

    const { data: votes, error: votesError } = await supabase
      .from("community_chat_poll_votes")
      .select("option_index")
      .eq("message_id", messageId);

    if (votesError) {
      throw votesError;
    }

    const counts = buildCounts(pollPayload.options.length, (votes ?? []) as Array<{ option_index: number }>);

    return NextResponse.json(
      {
        success: true,
        summary: {
          counts,
          totalVotes: counts.reduce((total, value) => total + value, 0),
          myVoteIndex,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error voting in poll:", error);
    return NextResponse.json({ error: "Failed to submit poll vote" }, { status: 500 });
  }
}
