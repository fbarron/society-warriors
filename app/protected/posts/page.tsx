"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, X } from "lucide-react";

const POLL_PREFIX = "[POLL]";

type Community = {
  id: string;
  name: string;
};

type ChatMember = {
  user_id: string;
  role: "owner" | "admin" | "moderator" | "member";
  user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
};

type ChatMessage = {
  id: number;
  content: string;
  attachment_url?: string | null;
  attachment_path?: string | null;
  attachment_file_name?: string | null;
  attachment_mime_type?: string | null;
  attachment_size_bytes?: number | null;
  poll_vote_counts?: number[] | null;
  poll_user_vote_index?: number | null;
  created_at: string;
  user_id: string;
  user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
};

type ParsedPoll = {
  question: string;
  options: string[];
};

const supabase = createClient();

const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
] as const;

type ChatAttachment = {
  url: string;
  path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

function isImageAttachment(mimeType?: string | null) {
  return Boolean(mimeType && mimeType.startsWith("image/"));
}

function parsePollFromContent(content: string): ParsedPoll | null {
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

function normalizeMessage(message: ChatMessage): ChatMessage {
  const poll = parsePollFromContent(message.content);
  if (!poll) {
    return message;
  }

  const counts =
    Array.isArray(message.poll_vote_counts) && message.poll_vote_counts.length === poll.options.length
      ? message.poll_vote_counts
      : Array.from({ length: poll.options.length }, () => 0);

  return {
    ...message,
    poll_vote_counts: counts,
    poll_user_vote_index:
      typeof message.poll_user_vote_index === "number" ? message.poll_user_vote_index : null,
  };
}

export default function SocietyChatPage() {
  const [loading, setLoading] = useState(true);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("Member");
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "reconnecting" | "error"
  >("idle");
  const [typingUserNames, setTypingUserNames] = useState<string[]>([]);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
  const [realtimeNonce, setRealtimeNonce] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [unreadByCommunity, setUnreadByCommunity] = useState<Record<string, number>>({});
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [votingMessageId, setVotingMessageId] = useState<number | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});
  const [translatableMessages, setTranslatableMessages] = useState<Record<number, boolean>>({});
  const [prefetchedTranslations, setPrefetchedTranslations] = useState<Record<number, string>>({});
  const [translatingMessageId, setTranslatingMessageId] = useState<number | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const roomNotifyChannelRef = useRef<RealtimeChannel | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  const selectedCommunity = useMemo(
    () => communities.find((community) => community.id === selectedCommunityId) ?? null,
    [communities, selectedCommunityId]
  );

  const fetchMessages = async (communityId: string) => {
    const response = await fetch(`/api/society/${communityId}/chat/messages?limit=100`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load messages");
    }

    setMessages((data.messages || []).map((message: ChatMessage) => normalizeMessage(message)));
  };

  const fetchMembers = async (communityId: string) => {
    const response = await fetch(`/api/society/${communityId}/chat/members`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load members");
    }

    setMembers(data.members || []);
  };

  const fetchChatData = async (communityId: string) => {
    setError(null);
    await Promise.all([fetchMessages(communityId), fetchMembers(communityId)]);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const scheduleReconnect = () => {
    clearReconnectTimer();
    setConnectionStatus("reconnecting");
    reconnectTimerRef.current = setTimeout(() => {
      setRealtimeNonce((prev) => prev + 1);
    }, 1500);
  };

  const scrollMessagesToBottom = (behavior: ScrollBehavior = "auto") => {
    const scrollContainer = messagesScrollRef.current;
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior,
    });
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("You must be logged in to use chat.");
          return;
        }

        setCurrentUserId(user.id);

        const { data: profile } = await supabase
          .from("users")
          .select("name")
          .eq("id", user.id)
          .single();

        setCurrentUserName(profile?.name || "Member");

        const { data: memberships, error: membershipError } = await supabase
          .from("community_memberships")
          .select("community:communities(id, name)")
          .eq("user_id", user.id)
          .eq("status", "active");

        if (membershipError) {
          throw membershipError;
        }

        const joinedCommunities = (memberships || [])
          .map((row: { community: Community | Community[] | null }) => {
            if (Array.isArray(row.community)) {
              return row.community[0] ?? null;
            }

            if (row.community && typeof row.community === "object") {
              return row.community;
            }

            return null;
          })
          .filter((community): community is Community => Boolean(community?.id && community?.name));

        setCommunities(joinedCommunities);

        if (joinedCommunities.length > 0) {
          const firstCommunityId = joinedCommunities[0].id;
          setSelectedCommunityId(firstCommunityId);
          await fetchChatData(firstCommunityId);
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load chat data");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    setTranslatedMessages({});
    setTranslatableMessages({});
    setPrefetchedTranslations({});
    setTranslatingMessageId(null);
  }, [selectedCommunityId]);

  useEffect(() => {
    const candidates = messages
      .filter((message) => !parsePollFromContent(message.content))
      .filter((message) => message.content.trim().length > 0)
      .filter((message) => translatableMessages[message.id] === undefined)
      .map((message) => ({ id: message.id, text: message.content }));

    if (candidates.length === 0) {
      return;
    }

    let cancelled = false;

    const detectTranslatableMessages = async () => {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ detectOnly: true, messages: candidates }),
        });

        const data = await response.json();
        if (!response.ok || !Array.isArray(data.results) || cancelled) {
          return;
        }

        setTranslatableMessages((prev) => {
          const next = { ...prev };
          for (const result of data.results as Array<{
            id: number;
            alreadyEnglish: boolean;
            translatedText: string | null;
          }>) {
            next[result.id] = !result.alreadyEnglish;
          }
          return next;
        });

        setPrefetchedTranslations((prev) => {
          const next = { ...prev };
          for (const result of data.results as Array<{
            id: number;
            alreadyEnglish: boolean;
            translatedText: string | null;
          }>) {
            if (!result.alreadyEnglish && typeof result.translatedText === "string") {
              next[result.id] = result.translatedText;
            }
          }
          return next;
        });
      } catch {
        if (!cancelled) {
          setTranslatableMessages((prev) => {
            const next = { ...prev };
            for (const candidate of candidates) {
              next[candidate.id] = false;
            }
            return next;
          });
        }
      }
    };

    void detectTranslatableMessages();

    return () => {
      cancelled = true;
    };
  }, [messages, translatableMessages]);

  useEffect(() => {
    if (!selectedCommunityId || !currentUserId) {
      return;
    }

    setConnectionStatus("connecting");
    setTypingUserNames([]);

    const channel = supabase.channel(`community-chat:${selectedCommunityId}:${realtimeNonce}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_chat_messages",
          filter: `community_id=eq.${selectedCommunityId}`,
        },
        (payload) => {
          const incoming = payload.new as {
            id: number;
            content: string;
            attachment_url?: string | null;
            attachment_path?: string | null;
            attachment_file_name?: string | null;
            attachment_mime_type?: string | null;
            attachment_size_bytes?: number | null;
            created_at: string;
            user_id: string;
          };

          setMessages((prev) => {
            if (prev.some((message) => message.id === incoming.id)) {
              return prev;
            }

            return [
              ...prev,
              normalizeMessage({
                id: incoming.id,
                content: incoming.content,
                attachment_url: incoming.attachment_url ?? null,
                attachment_path: incoming.attachment_path ?? null,
                attachment_file_name: incoming.attachment_file_name ?? null,
                attachment_mime_type: incoming.attachment_mime_type ?? null,
                attachment_size_bytes: incoming.attachment_size_bytes ?? null,
                created_at: incoming.created_at,
                user_id: incoming.user_id,
                user:
                  incoming.user_id === currentUserId
                    ? { id: currentUserId, name: currentUserName, avatar_url: null }
                    : null,
              }),
            ];
          });

          if (incoming.user_id !== currentUserId) {
            setDeliveryNotice("New message received");
            setTimeout(() => setDeliveryNotice(null), 2000);
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          userId: string;
          userName: string;
          typing: boolean;
        }>();

        const typingNames = new Set<string>();

        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            if (entry.userId !== currentUserId && entry.typing) {
              typingNames.add(entry.userName || "Someone");
            }
          });
        });

        setTypingUserNames(Array.from(typingNames));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearReconnectTimer();
          setConnectionStatus("connected");
          channel.track({ userId: currentUserId, userName: currentUserName, typing: false });
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          scheduleReconnect();
        }
      });

    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }

      clearReconnectTimer();
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [selectedCommunityId, currentUserId, currentUserName, realtimeNonce]);

  useEffect(() => {
    if (!currentUserId || communities.length === 0) {
      return;
    }

    const roomIds = new Set(communities.map((community) => community.id));
    const notifyChannel = supabase.channel(`community-chat-notify:${currentUserId}`);
    roomNotifyChannelRef.current = notifyChannel;

    notifyChannel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_chat_messages",
        },
        (payload) => {
          const incoming = payload.new as {
            community_id: string;
            user_id: string;
          };

          if (!roomIds.has(incoming.community_id) || incoming.user_id === currentUserId) {
            return;
          }

          if (incoming.community_id === selectedCommunityId) {
            setDeliveryNotice("New message received");
            setTimeout(() => setDeliveryNotice(null), 2000);
            return;
          }

          setUnreadByCommunity((prev) => ({
            ...prev,
            [incoming.community_id]: (prev[incoming.community_id] || 0) + 1,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifyChannel);
      roomNotifyChannelRef.current = null;
    };
  }, [communities, currentUserId, selectedCommunityId]);

  useEffect(() => {
    if (!selectedCommunityId) {
      return;
    }

    scrollMessagesToBottom();
  }, [selectedCommunityId]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    scrollMessagesToBottom();
  }, [messages.length]);

  const handleChannelChange = async (communityId: string) => {
    setSelectedCommunityId(communityId);
    setMessages([]);
    setMembers([]);
    setTypingUserNames([]);
    setDeliveryNotice(null);
    setUnreadByCommunity((prev) => ({ ...prev, [communityId]: 0 }));

    try {
      await fetchChatData(communityId);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load channel");
    }
  };

  const markTyping = (typing: boolean) => {
    const channel = channelRef.current;
    if (!channel) {
      return;
    }

    channel.track({ userId: currentUserId, userName: currentUserName, typing });
  };

  const handleTypingChange = (value: string) => {
    setMessageInput(value);

    if (!selectedCommunityId || !currentUserId) {
      return;
    }

    markTyping(value.trim().length > 0);

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      markTyping(false);
      typingStopTimerRef.current = null;
    }, 1200);
  };

  const handleAttachmentSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCommunityId) {
      setError("Select a channel before uploading a file.");
      return;
    }

    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type as any)) {
      setError("Allowed file types: PDF, TXT, JPG, PNG, GIF.");
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setError("Attachment must be 2MB or smaller.");
      return;
    }

    try {
      setUploadingAttachment(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/society/${selectedCommunityId}/chat/upload-file`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload attachment");
      }

      setPendingAttachment(data.attachment as ChatAttachment);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload attachment");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCommunityId || (!messageInput.trim() && !pendingAttachment)) {
      return;
    }

    try {
      setSending(true);
      setError(null);

      const response = await fetch(`/api/society/${selectedCommunityId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: messageInput.trim(),
          attachment: pendingAttachment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setMessageInput("");
      setPendingAttachment(null);
      markTyping(false);

      setMessages((prev) => {
        const message = normalizeMessage(data.message as ChatMessage);
        if (prev.some((entry) => entry.id === message.id)) {
          return prev;
        }

        return [...prev, message];
      });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((option, idx) => (idx === index ? value : option)));
  };

  const addPollOption = () => {
    setPollOptions((prev) => {
      if (prev.length >= 8) {
        return prev;
      }

      return [...prev, ""];
    });
  };

  const removePollOption = (index: number) => {
    setPollOptions((prev) => {
      if (prev.length <= 2) {
        return prev;
      }

      return prev.filter((_, idx) => idx !== index);
    });
  };

  const resetPollComposer = () => {
    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPollComposer(false);
  };

  const handleCreatePoll = async () => {
    if (!selectedCommunityId) {
      setError("Select a channel before creating a poll.");
      return;
    }

    const trimmedQuestion = pollQuestion.trim();
    const trimmedOptions = pollOptions.map((option) => option.trim()).filter((option) => option.length > 0);

    if (!trimmedQuestion || trimmedOptions.length < 2) {
      setError("Poll needs a question and at least two options.");
      return;
    }

    try {
      setSending(true);
      setError(null);

      const response = await fetch(`/api/society/${selectedCommunityId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poll: {
            question: trimmedQuestion,
            options: trimmedOptions,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create poll");
      }

      setMessages((prev) => {
        const message = normalizeMessage(data.message as ChatMessage);
        if (prev.some((entry) => entry.id === message.id)) {
          return prev;
        }

        return [...prev, message];
      });

      resetPollComposer();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create poll");
    } finally {
      setSending(false);
    }
  };

  const handleVote = async (message: ChatMessage, optionIndex: number) => {
    if (!selectedCommunityId) {
      return;
    }

    try {
      setVotingMessageId(message.id);
      setError(null);

      const response = await fetch(
        `/api/society/${selectedCommunityId}/chat/messages/${message.id}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionIndex }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit vote");
      }

      setMessages((prev) =>
        prev.map((entry) =>
          entry.id === message.id
            ? {
                ...entry,
                poll_vote_counts: data.summary.counts,
                poll_user_vote_index: data.summary.myVoteIndex,
              }
            : entry
        )
      );
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : "Failed to submit vote");
    } finally {
      setVotingMessageId(null);
    }
  };

  const handleTranslate = async (messageId: number, content: string) => {
    if (translatedMessages[messageId] !== undefined) {
      // Toggle off — remove translation
      setTranslatedMessages((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      return;
    }

    if (prefetchedTranslations[messageId]) {
      setTranslatedMessages((prev) => ({ ...prev, [messageId]: prefetchedTranslations[messageId] }));
      return;
    }

    try {
      setTranslatingMessageId(messageId);
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "Translation API key not found") {
          setTranslatedMessages((prev) => ({
            ...prev,
            [messageId]: "Translation API key not found",
          }));
          return;
        }
        throw new Error(data.error || "Translation failed");
      }

      if (data.alreadyEnglish) {
        setTranslatableMessages((prev) => ({ ...prev, [messageId]: false }));
        return;
      }

      const result =
        typeof data.translatedText === "string" && data.translatedText.trim().length > 0
          ? data.translatedText
          : "Translation unavailable";

      setPrefetchedTranslations((prev) =>
        result !== "Translation unavailable" ? { ...prev, [messageId]: result } : prev
      );
      setTranslatedMessages((prev) => ({ ...prev, [messageId]: result }));
    } catch {
      setTranslatedMessages((prev) => ({ ...prev, [messageId]: "Translation unavailable" }));
    } finally {
      setTranslatingMessageId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold">Members Chat</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Join a society to access its private group chat.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Members Chat</h1>
        <p className="text-sm text-muted-foreground">
          Group chat channels are private to active society members.
        </p>
      </div>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</Card>
      )}

      <div className="mb-4 flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs">
        <span>
          Connection: {connectionStatus === "connected" ? "Live" : connectionStatus === "reconnecting" ? "Reconnecting" : connectionStatus}
        </span>
        {deliveryNotice && <span className="text-green-700">{deliveryNotice}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        <Card className="p-3">
          <p className="mb-3 text-sm font-semibold">Society Channels</p>
          <div className="space-y-2">
            {communities.map((community) => (
              <button
                key={community.id}
                type="button"
                onClick={() => handleChannelChange(community.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  selectedCommunityId === community.id
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>#{community.name}</span>
                  {(unreadByCommunity[community.id] || 0) > 0 && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {unreadByCommunity[community.id]}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex h-[34rem] flex-col p-3">
          <p className="mb-3 text-sm font-semibold">
            {selectedCommunity ? `#${selectedCommunity.name}` : "Select a channel"}
          </p>

          <div className="mb-2 min-h-5 text-xs text-muted-foreground">
            {typingUserNames.length > 0
              ? `${typingUserNames.join(", ")} ${typingUserNames.length > 1 ? "are" : "is"} typing...`
              : ""}
          </div>

          <div
            ref={messagesScrollRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3"
          >
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
            )}

            {messages.map((message) => {
              const memberForMessage = members.find((member) => member.user_id === message.user_id);
              const senderName =
                message.user?.name || memberForMessage?.user?.name || message.user_id.slice(0, 8);
              const senderAvatarUrl = message.user?.avatar_url || memberForMessage?.user?.avatar_url || null;
              const parsedPoll = parsePollFromContent(message.content);

              return (
                <div key={message.id} className="flex max-w-[95%] items-start gap-2">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                    {senderAvatarUrl ? (
                      <Image
                        src={senderAvatarUrl}
                        alt={senderName}
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                        {senderName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">{senderName}</p>
                    {parsedPoll ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Poll</p>
                        <p className="font-medium">{parsedPoll.question}</p>
                        <div className="space-y-1">
                          {parsedPoll.options.map((option, index) => {
                            const counts =
                              Array.isArray(message.poll_vote_counts) &&
                              message.poll_vote_counts.length === parsedPoll.options.length
                                ? message.poll_vote_counts
                                : Array.from({ length: parsedPoll.options.length }, () => 0);
                            const totalVotes = counts.reduce((sum, value) => sum + value, 0);
                            const optionVotes = counts[index] || 0;
                            const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                            const isSelected = message.poll_user_vote_index === index;

                            return (
                              <button
                                key={`${message.id}-${index}`}
                                type="button"
                                onClick={() => handleVote(message, index)}
                                disabled={votingMessageId === message.id}
                                className={`w-full rounded border px-2 py-1 text-left text-xs ${
                                  isSelected
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "bg-muted/20 hover:bg-muted/40"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span>{option}</span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {optionVotes} vote{optionVotes === 1 ? "" : "s"} ({percentage}%)
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Total votes: {(message.poll_vote_counts || []).reduce((sum, value) => sum + value, 0)}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        {(translatableMessages[message.id] || translatedMessages[message.id] !== undefined) && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => handleTranslate(message.id, message.content)}
                              disabled={translatingMessageId === message.id}
                              className="text-[11px] text-blue-500 hover:underline disabled:opacity-50"
                            >
                              {translatingMessageId === message.id
                                ? "Translating..."
                                : translatedMessages[message.id] !== undefined
                                  ? "Hide translation"
                                  : "Translate"}
                            </button>
                            {translatedMessages[message.id] !== undefined && (
                              <p className="mt-1 rounded border-l-2 border-blue-300 bg-blue-50/60 px-2 py-1 text-xs italic text-muted-foreground">
                                {translatedMessages[message.id]}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    {message.attachment_url && (
                      <div className="mt-2">
                        {isImageAttachment(message.attachment_mime_type) ? (
                          <a href={message.attachment_url} target="_blank" rel="noreferrer" className="block w-fit">
                            <Image
                              src={message.attachment_url}
                              alt={message.attachment_file_name || "Attachment preview"}
                              width={140}
                              height={100}
                              className="h-24 w-auto rounded border object-contain"
                            />
                          </a>
                        ) : (
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded border bg-muted/40 px-2 py-1 text-xs text-blue-700 hover:underline"
                          >
                            Attachment: {message.attachment_file_name || "Download file"}
                            {typeof message.attachment_size_bytes === "number"
                              ? ` (${Math.ceil(message.attachment_size_bytes / 1024)} KB)`
                              : ""}
                          </a>
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {pendingAttachment && (
            <div className="mt-2 flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                {isImageAttachment(pendingAttachment.mime_type) && (
                  <Image
                    src={pendingAttachment.url}
                    alt={pendingAttachment.file_name}
                    width={48}
                    height={48}
                    className="h-10 w-10 rounded border object-cover"
                  />
                )}
                <span>
                  Pending attachment: {pendingAttachment.file_name} ({Math.ceil(pendingAttachment.size_bytes / 1024)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPendingAttachment(null)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}

          {showPollComposer && (
            <div className="mt-2 space-y-2 rounded-md border bg-muted/20 p-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold" htmlFor="poll-question">
                  Poll question
                </label>
                <input
                  id="poll-question"
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  placeholder="Ask something to the group"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold">Options</p>
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      value={option}
                      onChange={(event) => updatePollOption(index, event.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removePollOption(index)}
                      disabled={pollOptions.length <= 2}
                      className="rounded-md border px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addPollOption}
                  disabled={pollOptions.length >= 8}
                  className="rounded-md border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add option
                </button>
                <button
                  type="button"
                  onClick={handleCreatePoll}
                  disabled={sending}
                  className="rounded-md border bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? "Creating..." : "Create poll"}
                </button>
                <button
                  type="button"
                  onClick={resetPollComposer}
                  className="rounded-md border px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
            <input
              ref={attachmentInputRef}
              type="file"
              accept=".pdf,.txt,.jpg,.jpeg,.png,.gif"
              onChange={handleAttachmentSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={uploadingAttachment || sending}
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Attach file"
            >
              {uploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setShowPollComposer((prev) => !prev)}
              disabled={sending || uploadingAttachment}
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Poll
            </button>
            <input
              value={messageInput}
              onChange={(event) => handleTypingChange(event.target.value)}
              maxLength={2000}
              placeholder="Write a message or attach a file"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={sending || uploadingAttachment || (!messageInput.trim() && !pendingAttachment)}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </form>
        </Card>

        <Card className="p-3">
          <p className="mb-3 text-sm font-semibold">Members ({members.length})</p>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center gap-2 rounded-md border p-2">
                <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
                  {member.user?.avatar_url ? (
                    <Image
                      src={member.user.avatar_url}
                      alt={member.user?.name || "Member"}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.user?.name || member.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
