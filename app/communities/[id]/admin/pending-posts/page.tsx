"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostApprovalBadge } from "@/components/post-approval-badge";

const DEFAULT_AVATAR_URL = "/default-avatar.svg";
import { Check, X, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface PendingPost {
  id: string;
  content: string;
  image_metadata?: Array<{
    url: string;
    path: string;
    mime_type: string;
    size_bytes: number;
    filename: string;
  }>;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  user: {
    id: string;
    name: string;
    avatar_url: string;
  };
  comments: Array<any>;
}

export default function PendingPostsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [communityId, setCommunityId] = useState<string>("");
  const [communityName, setCommunityName] = useState<string>("");
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchParams = async () => {
      const { id } = await params;
      setCommunityId(id);

      // Fetch community info
      const { data: community } = await supabase
        .from("communities")
        .select("id, name")
        .eq("id", id)
        .single();

      if (community) {
        setCommunityName(community.name);
      }

      // Fetch pending posts
      try {
        const response = await fetch(`/api/society/${id}/pending-posts`);
        if (response.ok) {
          const data = await response.json();
          setPosts(data.posts || []);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchParams();
  }, [params, supabase]);

  const handleApprove = async (postId: string) => {
    setApprovingId(postId);
    try {
      const response = await fetch(`/api/society/posts/${postId}/approve`, {
        method: "PATCH",
      });

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        alert("Failed to approve post");
      }
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (postId: string) => {
    setRejectingId(postId);
    try {
      const response = await fetch(`/api/society/posts/${postId}/reject`, {
        method: "PATCH",
      });

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        alert("Failed to reject post");
      }
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <Link href={`/communities/${communityId}`} className="text-blue-600 hover:underline text-sm mb-4 block">
          ← Back to {communityName}
        </Link>
        <h1 className="text-3xl font-bold">Pending Post Approvals</h1>
        <p className="text-gray-600 mt-2">Review and approve posts from society members</p>
      </div>

      {posts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 text-lg">No pending posts to review</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <Card key={post.id} className="p-6">
              <div className="flex gap-4 mb-4">
                <Image
                  src={post.user.avatar_url || DEFAULT_AVATAR_URL}
                  alt={post.user.name}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{post.user.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(post.created_at).toLocaleString()}
                      </p>
                    </div>
                    <PostApprovalBadge status={post.status} />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-gray-800">{post.content}</p>
              </div>

              {post.image_metadata && post.image_metadata.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {post.image_metadata.map((image) => (
                    <a
                      key={image.path}
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border bg-muted/30 p-1"
                    >
                      <Image
                        src={image.url}
                        alt={image.filename || "Pending post image"}
                        width={420}
                        height={320}
                        className="h-auto max-h-[28rem] w-full object-contain"
                      />
                    </a>
                  ))}
                </div>
              )}

              {post.comments.length > 0 && (
                <div className="text-sm text-gray-500 mb-4">
                  {post.comments.length} comment{post.comments.length !== 1 ? "s" : ""}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => handleApprove(post.id)}
                  disabled={approvingId !== null || rejectingId !== null}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {approvingId === post.id && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleReject(post.id)}
                  disabled={approvingId !== null || rejectingId !== null}
                  variant="outline"
                  className="flex-1"
                >
                  {rejectingId === post.id && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
