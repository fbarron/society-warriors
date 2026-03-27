"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SocietyPostForm } from "@/components/society-post-form";
import { PostApprovalBadge } from "@/components/post-approval-badge";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Image from "next/image";

// Types
type User = {
  id: string;
  name: string;
  avatar_url: string;
};

type Community = {
  id: string;
  name: string;
  role?: "owner" | "admin" | "moderator" | "member";
};

type Comment = {
  id: string;
  post_id: string;
  content: string;
  created_at: string;
  user: User;
};

type Post = {
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
  user: User;
  community: Community;
  comments?: Comment[];
};

const DEFAULT_AVATAR_URL = "/default-avatar.svg";

const mergeUniquePosts = (existingPosts: Post[], incomingPosts: Post[]) => {
  const postMap = new Map<string, Post>();

  existingPosts.forEach((post) => {
    postMap.set(post.id, post);
  });

  incomingPosts.forEach((post) => {
    const current = postMap.get(post.id);
    postMap.set(post.id, current ? { ...current, ...post } : post);
  });

  return Array.from(postMap.values()).sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
  );
};

const supabase = createClient();

export default function SocialFeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [composeCommunityId, setComposeCommunityId] = useState<string>("");
  const loader = useRef<HTMLDivElement | null>(null);
  const postsScrollRef = useRef<HTMLDivElement | null>(null);
  const PAGE_SIZE = 10;
  const [page, setPage] = useState<number>(0);
  const toggleComments = (postId: string) => {
    setShowComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  // Fetch current user and joined communities
  useEffect(() => {
    const fetchUserAndCommunities = async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      // Fetch user profile
      const { data: userData } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .eq("id", userId)
        .single();

      if (userData) setCurrentUser(userData as User);

      // Fetch joined communities
      const { data: memberships } = await supabase
        .from("community_memberships")
        .select("community_id, role, community:communities(id, name)")
        .eq("user_id", userId)
        .eq("status", "active");

      if (memberships && memberships.length > 0) {
        const communities = memberships
          .map((m: any) => ({ ...(m.community || {}), role: m.role }))
          .filter((c: any) => c !== null) as Community[];
        setJoinedCommunities(communities);
        setComposeCommunityId(communities[0]?.id || "");

        if (communities.length > 0 && !selectedCommunityId) {
          setSelectedCommunityId(null); // Show all communities by default
        }
      }

      setLoading(false);
    };

    fetchUserAndCommunities();
  }, []);

  // Fetch posts from joined communities
  const fetchPosts = async (pageNum: number = 0) => {
    setLoading(true);

    // Get community IDs
    const communityIds = joinedCommunities.map((c) => c.id);

    if (communityIds.length === 0) {
      setLoading(false);
      return;
    }

    // Query posts from joined communities, status = approved
    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        id, 
        content, 
        image_metadata,
        status,
        created_at, 
        user:users(id, name, avatar_url), 
        community:communities(id, name),
        comments(id, content, created_at, post_id, user:users(id, name, avatar_url))
      `
      )
      .in("community_id", communityIds)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (error) {
      setLoading(false);
      return;
    }

    if (!data) {
      setLoading(false);
      return;
    }

    if (data.length < PAGE_SIZE) setHasMore(false);
    setPosts((prev) => mergeUniquePosts(prev, data as any as Post[]));
    setLoading(false);
  };

  useEffect(() => {
    if (joinedCommunities.length > 0) {
      fetchPosts(page);
    }
    // eslint-disable-next-line
  }, [page, joinedCommunities]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || loading || joinedCommunities.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 1, root: postsScrollRef.current }
    );
    if (loader.current) observer.observe(loader.current);
    return () => {
      if (loader.current) observer.unobserve(loader.current);
    };
  }, [hasMore, loading, joinedCommunities]);

  // Add comment
  const handleAddComment = async (
    postId: string,
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const comment = commentInputs[postId];
    if (!comment || !comment.trim()) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      alert("You must be logged in to comment.");
      return;
    }

    const { data, error } = await supabase
      .from("comments")
      .insert([
        { post_id: postId, content: comment, user_id: userId },
      ])
      .select(`id, content, created_at, post_id, user:users(id, name, avatar_url)`);

    if (!error && data) {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: [...(post.comments || []), data[0] as any as Comment],
              }
            : post
        )
      );
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (joinedCommunities.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome to Society Warriors</h1>
        <p className="text-gray-600 mb-6">
          You haven't joined any societies yet. Join or create a society to see posts!
        </p>
        <Link
          href="/communities"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
        >
          Discover Societies
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-2">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Your Feed
        </h1>
        <div className="flex gap-2">
          <Link
            href="/communities"
            className="text-blue-600 hover:underline text-sm"
          >
            Browse Societies
          </Link>
        </div>
      </div>

      <Card className="p-4 mb-6">
        <div className="mb-3">
          <label htmlFor="compose-society" className="text-sm font-semibold block mb-2">
            Post to Society
          </label>
          <select
            id="compose-society"
            value={composeCommunityId}
            onChange={(e) => setComposeCommunityId(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {joinedCommunities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </div>

        {composeCommunityId && (
          <SocietyPostForm
            communityId={composeCommunityId}
            communityName={
              joinedCommunities.find((community) => community.id === composeCommunityId)?.name ||
              "Selected Society"
            }
            userRole={
              (joinedCommunities.find((community) => community.id === composeCommunityId)?.role as
                | "owner"
                | "admin"
                | "moderator"
                | "member") || "member"
            }
            onPostCreated={() => {
              setPosts([]);
              setPage(0);
              setHasMore(true);
              fetchPosts(0);
            }}
          />
        )}
      </Card>

      {/* Societies filter */}
      {joinedCommunities.length > 1 && (
        <Card className="p-4 mb-6">
          <div className="text-sm font-semibold mb-3">Filter by Society:</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCommunityId(null)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedCommunityId === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              All ({joinedCommunities.length})
            </button>
            {joinedCommunities.map((community) => (
              <button
                key={community.id}
                onClick={() => setSelectedCommunityId(community.id)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCommunityId === community.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                {community.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Posts */}
      <div ref={postsScrollRef} className="max-h-[42rem] overflow-y-auto pr-4">
        <div className="flex flex-col gap-8">
          {posts
            .filter(
              (post) =>
                !selectedCommunityId ||
                post.community.id === selectedCommunityId
            )
            .map((post) => (
              <Card key={post.id} className="p-6">
              <div className="mb-4">
                <div className="flex items-start justify-between mb-3">
                  <Link
                    href={`/profile/${post.user?.id}`}
                    className="inline-flex items-center gap-3 rounded-md hover:bg-gray-100 px-2 py-1"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                      <Image
                        src={post.user?.avatar_url || DEFAULT_AVATAR_URL}
                        alt={post.user?.name || "User"}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-base">
                        {post.user?.name || "Unknown User"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(post.created_at).toLocaleString()}
                      </div>
                    </div>
                  </Link>
                  <PostApprovalBadge status={post.status} showLabel={false} />
                </div>
                <Link
                  href={`/communities/${post.community.id}`}
                  className="text-blue-600 hover:underline text-sm font-semibold"
                >
                  in {post.community.name}
                </Link>
              </div>

              <div className="mb-4 text-lg text-gray-900">{post.content}</div>

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
                        alt={image.filename || "Post image"}
                        width={420}
                        height={320}
                        className="h-auto max-h-[28rem] w-full object-contain"
                      />
                    </a>
                  ))}
                </div>
              )}

              {/* Comments */}
              <div className="mt-4">
                <button
                  className="text-blue-600 text-sm font-medium mb-2 hover:underline focus:outline-none"
                  onClick={() => toggleComments(post.id)}
                >
                  {showComments[post.id]
                    ? "Hide Comments"
                    : `Show Comments (${post.comments?.length || 0})`}
                </button>
                {showComments[post.id] && (
                  <>
                    <div className="font-bold mb-2 text-gray-700">
                      Comments
                    </div>
                    <ul className="mb-3 flex flex-col gap-2">
                      {(post.comments || []).map((comment) => (
                        <li
                          key={comment.id}
                          className="flex items-start gap-2 bg-gray-50 rounded p-2"
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                            <Image
                              src={comment.user?.avatar_url || DEFAULT_AVATAR_URL}
                              alt={comment.user?.name || "User"}
                              width={32}
                              height={32}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm">
                              {comment.user?.name || "Unknown User"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(comment.created_at).toLocaleString()}
                            </div>
                            <div className="text-sm mt-1">{comment.content}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <form
                      onSubmit={(e) => handleAddComment(post.id, e)}
                      className="flex gap-2 items-center"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        <Image
                          src={currentUser?.avatar_url || DEFAULT_AVATAR_URL}
                          alt={currentUser?.name || "avatar"}
                          width={32}
                          height={32}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <input
                        type="text"
                        className="border border-gray-300 rounded-full px-3 py-1 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="Add a comment"
                        value={commentInputs[post.id] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="submit"
                        className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-1 rounded-full font-semibold transition"
                      >
                        Comment
                      </button>
                    </form>
                  </>
                )}
              </div>
              </Card>
            ))}
        </div>

        {/* Loader for infinite scroll */}
        {hasMore && joinedCommunities.length > 0 && (
          <div
            ref={loader}
            className="py-8 text-center text-gray-500"
          >
            {loading ? "Loading..." : "Scroll for more"}
          </div>
        )}
      </div>

      {!hasMore && posts.length > 0 && (
        <div className="pt-3 text-center text-xs text-gray-500">
          You reached the end of the feed.
        </div>
      )}
    </div>
  );
}
