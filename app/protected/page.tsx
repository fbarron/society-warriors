"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Types
type User = {
  id: string;
  name: string;
  avatar_url: string;
};

type Comment = {
  id: number;
  post_id: number;
  content: string;
  created_at: string;
  user: User;
};

type Post = {
  id: number;
  content: string;
  created_at: string;
  user: User;
  comments?: Comment[];
};

const mergeUniquePosts = (existingPosts: Post[], incomingPosts: Post[]) => {
  const postMap = new Map<number, Post>();

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
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [newPost, setNewPost] = useState<string>("");
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [showComments, setShowComments] = useState<Record<number, boolean>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const loader = useRef<HTMLDivElement | null>(null);
  const PAGE_SIZE = 10;
  const [page, setPage] = useState<number>(0);
  const toggleComments = (postId: number) => {
    setShowComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };
  // Fetch current user profile for avatar
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setCurrentUser(null);
        return;
      }
      const { data: userData } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .eq("id", userId)
        .single();
      if (userData) setCurrentUser(userData as User);
    };
    fetchCurrentUser();
  }, []);

  // Fetch posts
  const fetchPosts = async (pageNum: number = 0) => {
    setLoading(true);
    // Fetch posts with user and comments with user
    const { data, error } = await supabase
      .from("posts")
      .select(`*, user:users(id, name, avatar_url), comments(*, user:users(id, name, avatar_url))`)
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
    setPosts((prev) => mergeUniquePosts(prev, data as Post[]));
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts(page);
    // eslint-disable-next-line
  }, [page]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 1 }
    );
    if (loader.current) observer.observe(loader.current);
    return () => {
      if (loader.current) observer.unobserve(loader.current);
    };
  }, [hasMore, loading]);

  // Add new post
  const handleAddPost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newPost.trim()) return;
    // Get current user id from Supabase Auth
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      alert("You must be logged in to post.");
      return;
    }
    const { data, error } = await supabase
      .from("posts")
      .insert([{ content: newPost, user_id: userId }])
      .select(`*, user:users(id, name, avatar_url)`);
    if (error) {
      console.error("Supabase Add Post Error:", error);
      alert("Error adding post: " + error.message);
      return;
    }
    if (data) {
      setPosts((prev) => mergeUniquePosts(prev, [data[0] as Post]));
      setNewPost("");
    }
  };

  // Add comment
  const handleAddComment = async (postId: number, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const comment = commentInputs[postId];
    if (!comment || !comment.trim()) return;
    // Get current user id from Supabase Auth
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      alert("You must be logged in to comment.");
      return;
    }
    const { data, error } = await supabase
      .from("comments")
      .insert([{ post_id: postId, content: comment, user_id: userId }])
      .select(`*, user:users(id, name, avatar_url)`);
    if (!error && data) {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, comments: [...(post.comments || []), data[0] as Comment] }
            : post
        )
      );
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-2">
      <h1 className="text-4xl font-extrabold mb-8 text-center tracking-tight">Social Feed</h1>
      {/* Add Post */}
      <form onSubmit={handleAddPost} className="mb-8 flex gap-3 items-center bg-white rounded-xl shadow p-4">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
          <img
            src={currentUser?.avatar_url || "/default-avatar.png"}
            alt={currentUser?.name || "avatar"}
            className="object-cover w-full h-full"
          />
        </div>
        <input
          type="text"
          className="border border-gray-300 rounded-full px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="What's on your mind?"
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-semibold transition"
        >
          Post
        </button>
      </form>

      {/* Posts */}
      <div className="flex flex-col gap-8">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                <img
                  src={post.user?.avatar_url || "/default-avatar.png"}
                  alt={post.user?.name || "User"}
                  className="object-cover w-full h-full"
                />
              </div>
              <div>
                <div className="font-semibold text-base">{post.user?.name || "Unknown User"}</div>
                <div className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div className="mb-4 text-lg font-medium text-gray-900">{post.content}</div>
            {/* Comments */}
            <div className="mt-4">
              <button
                className="text-blue-600 text-sm font-medium mb-2 focus:outline-none"
                onClick={() => toggleComments(post.id)}
              >
                {showComments[post.id] ? "Hide Comments" : `Show Comments (${post.comments?.length || 0})`}
              </button>
              {showComments[post.id] && (
                <>
                  <div className="font-bold mb-2 text-gray-700">Comments</div>
                  <ul className="mb-3 flex flex-col gap-2">
                    {(post.comments || []).map((comment) => (
                      <li key={comment.id} className="flex items-start gap-2 bg-gray-50 rounded p-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                          <img
                            src={comment.user?.avatar_url || "/default-avatar.png"}
                            alt={comment.user?.name || "User"}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{comment.user?.name || "Unknown User"}</div>
                          <div className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</div>
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
                      <img
                        src={currentUser?.avatar_url || "/default-avatar.png"}
                        alt={currentUser?.name || "avatar"}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <input
                      type="text"
                      className="border border-gray-300 rounded-full px-3 py-1 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Add a comment"
                      value={commentInputs[post.id] || ""}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
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
          </div>
        ))}
      </div>
      {/* Loader for infinite scroll */}
      {hasMore && (
        <div ref={loader} className="py-8 text-center text-gray-500">
          {loading ? "Loading..." : "Scroll for more"}
        </div>
      )}
    </div>
  );
}
