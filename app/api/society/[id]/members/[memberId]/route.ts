import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MemberRole = "owner" | "admin" | "moderator" | "member";

const ALLOWED_ROLES = new Set<MemberRole>(["admin", "moderator", "member"]);

async function getActorPermissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  communityId: string,
  actorId: string,
) {
  const [{ data: community }, { data: membership }] = await Promise.all([
    supabase.from("communities").select("created_by").eq("id", communityId).single(),
    supabase
      .from("community_memberships")
      .select("role, status")
      .eq("community_id", communityId)
      .eq("user_id", actorId)
      .single(),
  ]);

  return {
    isCreator: community?.created_by === actorId,
    myRole: membership?.status === "active" ? membership.role : null,
  };
}

async function getTargetMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  communityId: string,
  memberUserId: string,
) {
  const { data: membership } = await supabase
    .from("community_memberships")
    .select("role, status")
    .eq("community_id", communityId)
    .eq("user_id", memberUserId)
    .single();

  return membership;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const { id, memberId } = await context.params;
    const communityId = id.trim();
    const memberUserId = memberId.trim();
    const payload = await request.json().catch(() => null);
    const nextRoleRaw = String(payload?.role ?? "member").trim().toLowerCase() as MemberRole;

    if (!communityId || !memberUserId || !ALLOWED_ROLES.has(nextRoleRaw)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (user.id === memberUserId) {
      return NextResponse.json({ error: "You cannot change your own role here." }, { status: 400 });
    }

    const { isCreator, myRole } = await getActorPermissions(supabase, communityId, user.id);
    const targetMembership = await getTargetMembership(supabase, communityId, memberUserId);

    if (!isCreator && myRole !== "owner" && myRole !== "admin") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (!targetMembership || targetMembership.status !== "active") {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (targetMembership.role === "owner") {
      return NextResponse.json({ error: "Owner role cannot be changed." }, { status: 403 });
    }

    if (!isCreator && myRole === "admin" && (targetMembership.role === "admin" || nextRoleRaw === "admin")) {
      return NextResponse.json({ error: "Admins cannot promote or edit other admins." }, { status: 403 });
    }

    const { error } = await supabase
      .from("community_memberships")
      .update({ role: nextRoleRaw })
      .eq("community_id", communityId)
      .eq("user_id", memberUserId)
      .eq("status", "active");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/communities");
    revalidatePath(`/communities/${communityId}`);

    return NextResponse.json({ success: true, role: nextRoleRaw });
  } catch (error) {
    console.error("Failed to update member role", error);
    return NextResponse.json({ error: "Failed to update member role." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const { id, memberId } = await context.params;
    const communityId = id.trim();
    const memberUserId = memberId.trim();

    if (!communityId || !memberUserId) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (user.id === memberUserId) {
      return NextResponse.json({ error: "You cannot remove yourself here." }, { status: 400 });
    }

    const { isCreator, myRole } = await getActorPermissions(supabase, communityId, user.id);
    const targetMembership = await getTargetMembership(supabase, communityId, memberUserId);

    if (!isCreator && myRole !== "owner" && myRole !== "admin") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (!targetMembership || targetMembership.status !== "active") {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (targetMembership.role === "owner") {
      return NextResponse.json({ error: "Owner cannot be removed." }, { status: 403 });
    }

    if (!isCreator && myRole === "admin" && targetMembership.role === "admin") {
      return NextResponse.json({ error: "Admins cannot remove other admins." }, { status: 403 });
    }

    const { error } = await supabase
      .from("community_memberships")
      .delete()
      .eq("community_id", communityId)
      .eq("user_id", memberUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/communities");
    revalidatePath(`/communities/${communityId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove member", error);
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
}
