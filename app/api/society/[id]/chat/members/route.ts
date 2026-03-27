import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function assertActiveMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  communityId: string
) {
  const { data: membership } = await supabase
    .from("community_memberships")
    .select("user_id")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return Boolean(membership);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communityId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isMember = await assertActiveMembership(supabase, user.id, communityId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Only active community members can view member list" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("community_memberships")
      .select("user_id, role, user:users(id, name, avatar_url)")
      .eq("community_id", communityId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, members: data ?? [] }, { status: 200 });
  } catch (error) {
    console.error("Error fetching chat members:", error);
    return NextResponse.json(
      { error: "Failed to fetch member list" },
      { status: 500 }
    );
  }
}
