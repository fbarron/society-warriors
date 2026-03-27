import { createClient } from "@/lib/supabase/server";
import { createPost } from "@/lib/supabase/queries";
import { NextRequest, NextResponse } from "next/server";

type UploadedImageMetadata = {
  url: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  filename: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { communityId, content, imageMetadata } = body;
    const normalizedImageMetadata: UploadedImageMetadata[] = Array.isArray(imageMetadata)
      ? imageMetadata.filter(
          (entry: any) =>
            entry &&
            typeof entry.url === "string" &&
            typeof entry.path === "string" &&
            typeof entry.mime_type === "string" &&
            typeof entry.size_bytes === "number" &&
            typeof entry.filename === "string"
        )
      : [];

    if (normalizedImageMetadata.length > 4) {
      return NextResponse.json(
        { error: "Maximum of 4 images per post" },
        { status: 400 }
      );
    }

    if (!communityId || !content || !content.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: communityId, content" },
        { status: 400 }
      );
    }

    // Check if user is member of the community
    const { data: membership } = await supabase
      .from("community_memberships")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("community_id", communityId)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "You must be a member of this society to post" },
        { status: 403 }
      );
    }

    // Check if user is admin - if so, post is auto-approved, otherwise pending
    const userIsAdmin = membership.role === "owner" || membership.role === "admin";
    const status = userIsAdmin ? "approved" : "pending";

    // Create post
    const { data: postData, error: postError } = await createPost(
      communityId,
      user.id,
      content.trim(),
      status,
      normalizedImageMetadata
    );

    if (postError) {
      throw postError;
    }

    if (!postData || postData.length === 0) {
      return NextResponse.json(
        { error: "Failed to create post" },
        { status: 500 }
      );
    }

    // Create notifications for community members if post is approved
    if (userIsAdmin && postData && postData.length > 0) {
      const newPost = postData[0] as any;
      const { data: members } = await supabase
        .from("community_memberships")
        .select("user_id")
        .eq("community_id", communityId)
        .neq("user_id", user.id);

      if (members && members.length > 0) {
        const notifications = members.map((member) => ({
          user_id: member.user_id,
          actor_id: user.id,
          action_type: "post_created_in_society",
          target_id: newPost.id,
          target_type: "post",
          message: `${newPost.user.name} posted in ${newPost.community.name}`,
        }));

        await supabase.from("notifications").insert(notifications);
      }
    } else if (!userIsAdmin && postData && postData.length > 0) {
      const newPost = postData[0] as any;
      // Notify admins of pending post
      const { data: admins } = await supabase
        .from("community_memberships")
        .select("user_id")
        .eq("community_id", communityId)
        .in("role", ["owner", "admin"]);

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          user_id: admin.user_id,
          actor_id: user.id,
          action_type: "post_assigned_to_you",
          target_id: communityId,
          target_type: "community_pending_posts",
          message: `New post pending approval from ${newPost.user.name} in ${newPost.community.name}`,
        }));

        await supabase.from("notifications").insert(notifications);
      }
    }

    return NextResponse.json(
      {
        success: true,
        post: postData[0],
        message: userIsAdmin
          ? "Post published successfully"
          : "Post submitted for approval",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
