import { createClient } from "@/lib/supabase/server";
import { rejectPost, isAdmin } from "@/lib/supabase/queries";
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

    if (post.status === "rejected") {
      return NextResponse.json(
        { error: "This post is already rejected" },
        { status: 400 }
      );
    }

    // Check if user is admin of this community
    const adminCheck = await isAdmin(user.id, post.community_id);

    if (!adminCheck) {
      return NextResponse.json(
        { error: "Only community admins can reject posts" },
        { status: 403 }
      );
    }

    // Reject post
    const { data: rejectedPost, error: rejectError } = await rejectPost(
      postId
    );

    if (rejectError || !rejectedPost) {
      throw rejectError;
    }

    // Notify post author about rejection
    await supabase.from("notifications").insert([
      {
        user_id: post.user_id,
        actor_id: user.id,
        action_type: "post_rejected",
        target_id: postId,
        target_type: "post",
        message: "Your post has been rejected",
      },
    ]);

    return NextResponse.json(
      {
        success: true,
        post: rejectedPost && rejectedPost.length > 0 ? (rejectedPost[0] as any) : null,
        message: "Post rejected successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error rejecting post:", error);
    return NextResponse.json(
      { error: "Failed to reject post" },
      { status: 500 }
    );
  }
}
