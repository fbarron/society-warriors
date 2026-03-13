"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserProfile = {
  id: string;
  name: string;
  avatar_url: string;
  bio?: string;
};

type Post = {
  id: number;
  content: string;
  created_at: string;
};

const supabase = createClient();

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const profileId = params?.id;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicProfile = async () => {
      if (!profileId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: userData } = await supabase
        .from("users")
        .select("id, name, avatar_url, bio")
        .eq("id", profileId)
        .single();

      const { data: postsData } = await supabase
        .from("posts")
        .select("id, content, created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      setProfile((userData as UserProfile) || null);
      setPosts((postsData as Post[]) || []);
      setLoading(false);
    };

    fetchPublicProfile();
  }, [profileId]);

  if (loading) return <div className="py-10 text-center">Loading profile...</div>;
  if (!profile) return <div className="py-10 text-center">Profile not found.</div>;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-4">
        <Link href="/protected" className="text-sm text-blue-600 hover:underline">
          ← Back to feed
        </Link>
      </div>

      <div className="flex flex-col items-center bg-white rounded-xl shadow p-8 mb-8">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-4">
          <img
            src={profile.avatar_url || "/default-avatar.png"}
            alt={profile.name || "User"}
            className="object-cover w-full h-full"
          />
        </div>
        <h2 className="text-2xl font-bold mb-1">{profile.name || "Unknown User"}</h2>
        {profile.bio && <div className="text-center text-gray-700">{profile.bio}</div>}
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-xl font-bold mb-4">Posts</h3>
        {posts.length === 0 ? (
          <div className="text-gray-500">No posts yet.</div>
        ) : (
          <ul className="flex flex-col gap-4">
            {posts.map((post) => (
              <li key={post.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                <div className="font-semibold text-lg mb-1">{post.content}</div>
                <div className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
