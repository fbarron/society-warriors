import { deletePost as deletePostRecord, getCommunityRole } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MODERATION_ROLES = new Set(["owner", "admin", "moderator"]);

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: postId } = await params;

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, community_id, user_id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const [{ data: community }, membership] = await Promise.all([
      supabase.from("communities").select("created_by").eq("id", post.community_id).single(),
      getCommunityRole(user.id, post.community_id),
    ]);

    const isAuthor = post.user_id === user.id;
    const canModerate =
      community?.created_by === user.id ||
      (membership.status === "active" && MODERATION_ROLES.has(membership.role ?? ""));

    if (!isAuthor && !canModerate) {
      return NextResponse.json(
        { error: "Only the post author or a moderator can delete this post" },
        { status: 403 },
      );
    }

    const { error: deleteError } = await deletePostRecord(postId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json(
      { success: true, message: "Post deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
