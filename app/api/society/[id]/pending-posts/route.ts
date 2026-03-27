import { createClient } from "@/lib/supabase/server";
import { getPendingPosts, isAdmin } from "@/lib/supabase/queries";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communityId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin of this community
    const adminCheck = await isAdmin(user.id, communityId);

    if (!adminCheck) {
      return NextResponse.json(
        { error: "Only community admins can view pending posts" },
        { status: 403 }
      );
    }

    // Get pending posts
    const { data: pendingPosts, error } = await getPendingPosts(communityId);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        posts: pendingPosts || [],
        count: pendingPosts?.length || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching pending posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending posts" },
      { status: 500 }
    );
  }
}
