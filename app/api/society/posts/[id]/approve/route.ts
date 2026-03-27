import { createClient } from "@/lib/supabase/server";
import { approvePost, isAdmin } from "@/lib/supabase/queries";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get post to find community
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, community_id, user_id, status")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.status === "approved") {
      return NextResponse.json(
        { error: "This post is already approved" },
        { status: 400 }
      );
    }

    // Check if user is admin of this community
    const adminCheck = await isAdmin(user.id, post.community_id);

    if (!adminCheck) {
      return NextResponse.json(
        { error: "Only community admins can approve posts" },
        { status: 403 }
      );
    }

    // Approve post
    const { data: approvedPost, error: approveError } = await approvePost(
      postId
    );

    if (approveError || !approvedPost) {
      throw approveError;
    }

    // Notify all community members about the approved post
    const { data: members } = await supabase
      .from("community_memberships")
      .select("user_id")
      .eq("community_id", post.community_id)
      .neq("user_id", post.user_id);

    if (members && members.length > 0 && approvedPost && approvedPost.length > 0) {
      const postData = approvedPost[0] as any;
      const notifications = members.map((member) => ({
        user_id: member.user_id,
        actor_id: user.id,
        action_type: "post_created_in_society",
        target_id: postId,
        target_type: "post",
        message: `New post from ${postData.user.name}`,
      }));

      await supabase.from("notifications").insert(notifications);
    }

    // Notify post author
    await supabase.from("notifications").insert([
      {
        user_id: post.user_id,
        actor_id: user.id,
        action_type: "post_approved",
        target_id: postId,
        target_type: "post",
        message: "Your post has been approved",
      },
    ]);

    return NextResponse.json(
      {
        success: true,
        post: approvedPost && approvedPost.length > 0 ? (approvedPost[0] as any) : null,
        message: "Post approved successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error approving post:", error);
    return NextResponse.json(
      { error: "Failed to approve post" },
      { status: 500 }
    );
  }
}
