/**
 * Supabase Database Queries
 * All database operations for the new society-based posting system
 */

import { createClient } from "./server";

export type PostStatus = "pending" | "approved" | "rejected";
export type PostImageMetadata = {
  url: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  filename: string;
};

// ============================================================================
// POSTS QUERIES
// ============================================================================

export async function createPost(
  communityId: string,
  userId: string,
  content: string,
  status: PostStatus = "pending",
  imageMetadata: PostImageMetadata[] = []
) {
  const client = await createClient();
  const { data, error } = await client
    .from("posts")
    .insert([
      {
        community_id: communityId,
        user_id: userId,
        content,
        status,
        image_metadata: imageMetadata,
        status_updated_at: new Date().toISOString(),
      },
    ])
    .select(
      `
      id,
      content,
      image_metadata,
      status,
      created_at,
      status_updated_at,
      user:users(id, name, avatar_url),
      community:communities(id, name)
    `
    );

  return { data, error };
}

export async function getPendingPosts(communityId: string) {
  const client = await createClient();
  const { data, error } = await client
    .from("posts")
    .select(
      `
      id,
      content,
      image_metadata,
      status,
      created_at,
      status_updated_at,
      user:users(id, name, avatar_url),
      comments(id)
    `
    )
    .eq("community_id", communityId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return { data, error };
}

export async function approvePost(postId: string) {
  const client = await createClient();
  const { data, error } = await client
    .from("posts")
    .update({
      status: "approved",
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select(
      `
      id,
      content,
      image_metadata,
      status,
      created_at,
      user:users(id, name, avatar_url)
    `
    );

  return { data, error };
}

export async function rejectPost(postId: string) {
  const client = await createClient();
  const { data, error } = await client
    .from("posts")
    .update({
      status: "rejected",
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select(
      `
      id,
      content,
      image_metadata,
      status,
      created_at,
      user:users(id, name, avatar_url)
    `
    );

  return { data, error };
}

export async function deletePost(postId: string) {
  const client = await createClient();
  const { data: post, error: postLookupError } = await client
    .from("posts")
    .select("id, image_metadata")
    .eq("id", postId)
    .single();

  if (postLookupError || !post) {
    return { data: null, error: postLookupError ?? new Error("Post not found") };
  }

  const { error: commentsError } = await client.from("comments").delete().eq("post_id", postId);
  if (commentsError) {
    return { data: null, error: commentsError };
  }

  const { error: notificationsError } = await client
    .from("notifications")
    .delete()
    .eq("target_id", postId)
    .eq("target_type", "post");
  if (notificationsError) {
    return { data: null, error: notificationsError };
  }

  const imagePaths = Array.isArray(post.image_metadata)
    ? post.image_metadata
        .map((image: Partial<PostImageMetadata> | null | undefined) => image?.path)
        .filter((path): path is string => typeof path === "string" && path.length > 0)
    : [];

  if (imagePaths.length > 0) {
    await client.storage.from("post-images").remove(imagePaths);
  }

  const { data, error } = await client.from("posts").delete().eq("id", postId).select("id").maybeSingle();

  return { data, error };
}

export async function getApprovedPostsForCommunities(
  communityIds: string[],
  limit = 20,
  offset = 0
) {
  const client = await createClient();
  const { data, error } = await client
    .from("posts")
    .select(
      `
      id,
      content,
      image_metadata,
      status,
      created_at,
      community:communities(id, name),
      user:users(id, name, avatar_url),
      comments(id, content, created_at, user:users(id, name, avatar_url))
    `
    )
    .in("community_id", communityIds)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return { data, error };
}

// ============================================================================
// NOTIFICATIONS QUERIES
// ============================================================================

export async function createNotification(
  userId: string,
  actorId: string,
  actionType: string,
  targetId: string | null,
  targetType: string | null,
  message: string
) {
  const client = await createClient();
  const { data, error } = await client
    .from("notifications")
    .insert([
      {
        user_id: userId,
        actor_id: actorId,
        action_type: actionType,
        target_id: targetId,
        target_type: targetType,
        message,
      },
    ])
    .select(`id, created_at`);

  return { data, error };
}

export async function getUserNotifications(userId: string, limit = 20) {
  const client = await createClient();
  const { data, error } = await client
    .from("notifications")
    .select(
      `
      id,
      action_type,
      message,
      read,
      created_at,
      target_id,
      target_type,
      actor:users!notifications_actor_id_fkey(id, name, avatar_url)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data, error };
}

export async function markNotificationAsRead(notificationId: string) {
  const client = await createClient();
  const { data, error } = await client
    .from("notifications")
    .update({ read: true, updated_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select("id, read");

  return { data, error };
}

export async function getUnreadNotificationCount(userId: string) {
  const client = await createClient();
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact" })
    .eq("user_id", userId)
    .eq("read", false);

  return { count, error };
}

// ============================================================================
// COMMUNITY MEMBERSHIP & ROLE CHECKS
// ============================================================================

export async function getCommunityRole(
  userId: string,
  communityId: string
): Promise<{ role: string | null; status: string | null; error: any }> {
  const client = await createClient();
  const { data, error } = await client
    .from("community_memberships")
    .select("role, status")
    .eq("user_id", userId)
    .eq("community_id", communityId)
    .single();

  if (!data) {
    return { role: null, status: null, error };
  }

  return { role: data.role, status: data.status, error };
}

export async function isAdmin(
  userId: string,
  communityId: string
): Promise<boolean> {
  const { role, error } = await getCommunityRole(userId, communityId);
  if (error) return false;
  return role === "owner" || role === "admin";
}

export async function getCommunityMembers(communityId: string) {
  const client = await createClient();
  const { data, error } = await client
    .from("community_memberships")
    .select(
      `
      community_id,
      user_id,
      role,
      status,
      created_at,
      user:users(id, name, avatar_url)
    `
    )
    .eq("community_id", communityId)
    .order("role", { ascending: false });

  return { data, error };
}

// ============================================================================
// TEMPLATES QUERIES
// ============================================================================

export async function getSocietyTemplates() {
  const client = await createClient();
  const { data, error } = await client
    .from("society_templates")
    .select(`id, name, description, category, icon, suggested_description`)
    .order("name", { ascending: true });

  return { data, error };
}

export async function getTemplateById(templateId: string) {
  const client = await createClient();
  const { data, error } = await client
    .from("society_templates")
    .select(
      `id, name, description, category, icon, default_rules, suggested_description`
    )
    .eq("id", templateId)
    .single();

  return { data, error };
}
