"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Types
interface UserProfile {
  id: string;
  name: string;
  avatar_url: string;
  bio?: string;
}

const supabase = createClient();

type Post = {
  id: number;
  content: string;
  created_at: string;
  comments?: { id: number; content: string; created_at: string }[];
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: "", avatar_url: "", bio: "" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showComments, setShowComments] = useState<Record<number, boolean>>({});
    const toggleComments = (postId: number) => {
      setShowComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
    };
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchProfileAndPosts = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email || "");
      const { data: userData, error } = await supabase
        .from("users")
        .select("id, name, avatar_url, bio")
        .eq("id", user.id)
        .single();
      if (!error && userData) {
        setProfile(userData as UserProfile);
        setForm({
          name: userData.name || "",
          avatar_url: userData.avatar_url || "",
          bio: userData.bio || "",
        });
      }
      // Fetch user's posts
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, content, created_at, comments(id, content, created_at)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setPosts(postsData || []);
      setLoading(false);
    };
    fetchProfileAndPosts();
  }, []);

  if (loading) return <div className="py-10 text-center">Loading...</div>;
  if (!profile) return <div className="py-10 text-center">Profile not found.</div>;

  const handleEdit = () => setEditMode(true);
  const handleCancel = () => {
    setEditMode(false);
    setForm({
      name: profile.name || "",
      avatar_url: profile.avatar_url || "",
      bio: profile.bio || "",
    });
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAvatarFile(e.target.files[0]);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return null;
    setAvatarUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAvatarUploading(false);
      return null;
    }
    const fileExt = avatarFile.name.split('.').pop();
    const filePath = `avatars/${user.id}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
    if (uploadError) {
      alert('Avatar upload failed: ' + uploadError.message);
      setAvatarUploading(false);
      return null;
    }
    // Get public URL
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setAvatarUploading(false);
    return publicUrlData?.publicUrl || null;
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let avatarUrl = form.avatar_url;
    if (avatarFile) {
      const uploadedUrl = await handleAvatarUpload();
      if (uploadedUrl) avatarUrl = uploadedUrl;
    }
    const { error } = await supabase
      .from("users")
      .update({
        name: form.name,
        avatar_url: avatarUrl,
        bio: form.bio,
      })
      .eq("id", profile.id);
    if (!error) {
      setProfile((p) => p && { ...p, ...form, avatar_url: avatarUrl });
      setEditMode(false);
      setAvatarFile(null);
    } else {
      alert("Error updating profile: " + error.message);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="flex flex-col items-center bg-white rounded-xl shadow p-8 mb-8">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-4">
          <img
            src={profile.avatar_url || "/default-avatar.png"}
            alt={profile.name}
            className="object-cover w-full h-full"
          />
        </div>
        {editMode ? (
          <form onSubmit={handleSave} className="w-full max-w-xs flex flex-col gap-3 items-center">
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="border rounded px-3 py-2 w-full"
              placeholder="Name"
              required
            />
            <div className="w-full flex flex-col gap-1">
              <label className="text-sm font-medium">Avatar</label>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                className="w-full"
              />
              {avatarUploading && <div className="text-xs text-blue-600">Uploading...</div>}
              {avatarFile && <div className="text-xs text-gray-600">Selected: {avatarFile.name}</div>}
            </div>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              className="border rounded px-3 py-2 w-full"
              placeholder="Bio"
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={saving || avatarUploading}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" className="bg-gray-400 text-white px-4 py-2 rounded" onClick={handleCancel} disabled={saving || avatarUploading}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-1">{profile.name}</h2>
            <div className="text-gray-500 mb-2">{email}</div>
            {profile.bio && <div className="text-center text-gray-700 mb-4">{profile.bio}</div>}
            <button className="bg-blue-600 text-white px-4 py-2 rounded mt-2" onClick={handleEdit}>
              Edit Profile
            </button>
          </>
        )}
      </div>
      {/* User's Posts */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-xl font-bold mb-4">Your Posts</h3>
        {posts.length === 0 ? (
          <div className="text-gray-500">You haven't posted anything yet.</div>
        ) : (
          <ul className="flex flex-col gap-4">
            {posts.map((post) => (
              <li key={post.id} className="border-b pb-3">
                <div className="font-semibold text-lg mb-1">{post.content}</div>
                <div className="text-xs text-gray-500 mb-1">{new Date(post.created_at).toLocaleString()}</div>
                <button
                  className="text-blue-600 text-sm font-medium mb-1 focus:outline-none"
                  onClick={() => toggleComments(post.id)}
                >
                  {showComments[post.id] ? "Hide Comments" : `Show Comments (${post.comments?.length || 0})`}
                </button>
                {showComments[post.id] && (
                  <div className="ml-2">
                    <span className="font-bold text-sm">Comments:</span>
                    <ul className="ml-2 mt-1">
                      {(post.comments || []).map((c) => (
                        <li key={c.id} className="text-sm text-gray-700 border-b last:border-b-0 py-1">
                          {c.content}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
