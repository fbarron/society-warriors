import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type CommunityDetail = {
  id: string;
  name: string;
  privacy: "public" | "private";
  description: string;
  category: string;
  createdBy: string | null;
};

type MembershipRow = {
  user_id: string;
  role: string | null;
  status: string | null;
};

type UserRow = {
  id: string;
  name: string | null;
};

async function getActorPermissions(communityId: string, actorId: string) {
  const supabase = await createClient();
  const { data: community } = await supabase
    .from("communities")
    .select("created_by")
    .eq("id", communityId)
    .single();

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("role, status")
    .eq("community_id", communityId)
    .eq("user_id", actorId)
    .single();

  const isCreator = community?.created_by === actorId;
  const myRole = membership?.status === "active" ? membership.role : null;

  return { supabase, isCreator, myRole };
}

async function updateCommunity(formData: FormData) {
  "use server";

  const communityId = String(formData.get("communityId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const privacyRaw = String(formData.get("privacy") ?? "public").trim().toLowerCase();
  const privacy = privacyRaw === "private" ? "private" : "public";

  if (!communityId || !name) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { isCreator, myRole } = await getActorPermissions(communityId, user.id);
  const canEdit =
    isCreator || myRole === "owner" || myRole === "admin" || myRole === "moderator";

  if (!canEdit) {
    return;
  }

  const { error } = await supabase
    .from("communities")
    .update({
      name,
      description,
      category: category || "General",
      privacy,
    })
    .eq("id", communityId);

  if (error) {
    console.error("Failed to update community", error);
    return;
  }

  revalidatePath("/communities");
  revalidatePath(`/communities/${communityId}`);
}

async function updateMemberRole(formData: FormData) {
  "use server";

  const communityId = String(formData.get("communityId") ?? "").trim();
  const memberUserId = String(formData.get("memberUserId") ?? "").trim();
  const nextRoleRaw = String(formData.get("role") ?? "member").trim().toLowerCase();
  const nextRole =
    nextRoleRaw === "admin" || nextRoleRaw === "moderator" ? nextRoleRaw : "member";

  if (!communityId || !memberUserId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id === memberUserId) {
    return;
  }

  const { isCreator, myRole } = await getActorPermissions(communityId, user.id);
  if (!isCreator && myRole !== "owner" && myRole !== "admin") {
    return;
  }

  const { data: targetMembership } = await supabase
    .from("community_memberships")
    .select("role, status")
    .eq("community_id", communityId)
    .eq("user_id", memberUserId)
    .single();

  if (!targetMembership || targetMembership.status !== "active") {
    return;
  }

  const targetRole = targetMembership.role;
  if (targetRole === "owner") {
    return;
  }

  if (!isCreator && myRole === "admin") {
    if (targetRole === "admin") {
      return;
    }
    if (nextRole === "admin") {
      return;
    }
  }

  await supabase
    .from("community_memberships")
    .update({ role: nextRole })
    .eq("community_id", communityId)
    .eq("user_id", memberUserId)
    .eq("status", "active");

  revalidatePath("/communities");
  revalidatePath(`/communities/${communityId}`);
}

async function removeMember(formData: FormData) {
  "use server";

  const communityId = String(formData.get("communityId") ?? "").trim();
  const memberUserId = String(formData.get("memberUserId") ?? "").trim();

  if (!communityId || !memberUserId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id === memberUserId) {
    return;
  }

  const { isCreator, myRole } = await getActorPermissions(communityId, user.id);
  if (!isCreator && myRole !== "owner" && myRole !== "admin") {
    return;
  }

  const { data: targetMembership } = await supabase
    .from("community_memberships")
    .select("role, status")
    .eq("community_id", communityId)
    .eq("user_id", memberUserId)
    .single();

  if (!targetMembership || targetMembership.status !== "active") {
    return;
  }

  const targetRole = targetMembership.role;
  if (targetRole === "owner") {
    return;
  }

  if (!isCreator && myRole === "admin" && targetRole === "admin") {
    return;
  }

  await supabase
    .from("community_memberships")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", memberUserId);

  revalidatePath("/communities");
  revalidatePath(`/communities/${communityId}`);
}

async function joinCommunity(formData: FormData) {
  "use server";

  const communityId = String(formData.get("communityId") ?? "").trim();
  if (!communityId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase.from("community_memberships").upsert(
    {
      community_id: communityId,
      user_id: user.id,
      role: "member",
      status: "active",
    },
    { onConflict: "community_id,user_id" },
  );

  revalidatePath("/communities");
  revalidatePath(`/communities/${communityId}`);
}

async function leaveCommunity(formData: FormData) {
  "use server";

  const communityId = String(formData.get("communityId") ?? "").trim();
  if (!communityId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase
    .from("community_memberships")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", user.id);

  revalidatePath("/communities");
  revalidatePath(`/communities/${communityId}`);
}

function toCommunityDetail(raw: Record<string, unknown>): CommunityDetail {
  return {
    id: String(raw.id ?? ""),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Unnamed society",
    privacy:
      typeof raw.privacy === "string" && raw.privacy.toLowerCase() === "private"
        ? "private"
        : "public",
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description
        : "No description yet.",
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category : "General",
    createdBy: typeof raw.created_by === "string" ? raw.created_by : null,
  };
}

async function CommunityDetailContent({ communityId }: { communityId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawCommunity, error: communityError } = await supabase
    .from("communities")
    .select("*")
    .eq("id", communityId)
    .single();

  if (communityError || !rawCommunity) {
    notFound();
  }

  const community = toCommunityDetail(rawCommunity as Record<string, unknown>);

  const { data: memberships } = await supabase
    .from("community_memberships")
    .select("user_id, role, status")
    .eq("community_id", community.id)
    .eq("status", "active");

  const activeMemberships = (memberships ?? []) as MembershipRow[];
  const activeMemberIds = activeMemberships.map((row) => row.user_id);
  const { data: usersData } =
    activeMemberIds.length > 0
      ? await supabase.from("users").select("id, name").in("id", activeMemberIds)
      : { data: [] as UserRow[] };

  const usersById = new Map((usersData ?? []).map((profile) => [profile.id, profile.name]));

  const memberCount = activeMemberships.length;
  const myMembership = user ? activeMemberships.find((row) => row.user_id === user.id) : null;
  const isMember = Boolean(myMembership);
  const myRole = myMembership?.role ?? null;
  const isCreator = Boolean(user && community.createdBy === user.id);
  const canEditCommunity =
    isCreator || myRole === "owner" || myRole === "admin" || myRole === "moderator";
  const canManageMembers = isCreator || myRole === "owner" || myRole === "admin";
  const { count: pendingPostsCount } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("community_id", community.id)
    .eq("status", "pending");

  return (
    <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-2xl">{community.name}</CardTitle>
            <Badge variant="outline">{community.privacy === "private" ? "Private" : "Public"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {community.category} • {memberCount} members
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <p className="text-sm">{community.description}</p>

          {canManageMembers && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Admin Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild>
                    <Link href={`/communities/${community.id}/admin/pending-posts`}>
                      Pending Approvals ({pendingPostsCount ?? 0})
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Review and approve member posts awaiting moderation.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {canEditCommunity && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Edit society</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateCommunity} className="space-y-3">
                  <input type="hidden" name="communityId" value={community.id} />

                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="name">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      defaultValue={community.name}
                      required
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="description">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      defaultValue={community.description}
                      rows={3}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor="category">
                        Category
                      </label>
                      <input
                        id="category"
                        name="category"
                        defaultValue={community.category}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor="privacy">
                        Privacy
                      </label>
                      <select
                        id="privacy"
                        name="privacy"
                        defaultValue={community.privacy}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                  </div>

                  <Button type="submit" variant="secondary">
                    Save changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {canManageMembers && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Manage members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeMemberships.map((member) => {
                    const isMe = user?.id === member.user_id;
                    const displayName =
                      usersById.get(member.user_id) ||
                      (isMe ? "You" : `User ${member.user_id.slice(0, 8)}`);
                    const targetRole = member.role || "member";
                    const canModifyRole =
                      !isMe &&
                      (((isCreator || myRole === "owner") && targetRole !== "owner") ||
                        (myRole === "admin" && targetRole !== "owner" && targetRole !== "admin"));

                    return (
                      <div
                        key={member.user_id}
                        className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">{displayName}</p>
                          <p className="text-xs text-muted-foreground">{member.user_id}</p>
                        </div>

                        {isMe ? (
                          <Badge variant="outline">{targetRole}</Badge>
                        ) : canModifyRole ? (
                          <div className="flex items-center gap-2">
                            <form action={updateMemberRole} className="flex items-center gap-2">
                              <input type="hidden" name="communityId" value={community.id} />
                              <input type="hidden" name="memberUserId" value={member.user_id} />
                              <select
                                name="role"
                                defaultValue={targetRole}
                                className="rounded-md border bg-background px-2 py-1 text-sm"
                              >
                                <option value="member">member</option>
                                <option value="moderator">moderator</option>
                                {(isCreator || myRole === "owner") && <option value="admin">admin</option>}
                              </select>
                              <Button size="sm" type="submit" variant="secondary">
                                Update role
                              </Button>
                            </form>

                            <form action={removeMember}>
                              <input type="hidden" name="communityId" value={community.id} />
                              <input type="hidden" name="memberUserId" value={member.user_id} />
                              <Button size="sm" type="submit" variant="outline">
                                Remove
                              </Button>
                            </form>
                          </div>
                        ) : (
                          <Badge variant="outline">{targetRole}</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {!user && (
            <p className="text-sm text-muted-foreground">Log in to join this society.</p>
          )}

          {user && (
            <div className="flex gap-2">
              {isMember ? (
                <form action={leaveCommunity}>
                  <input type="hidden" name="communityId" value={community.id} />
                  <Button type="submit" variant="outline">
                    Leave society
                  </Button>
                </form>
              ) : community.privacy === "private" ? (
                <Button disabled>Private society</Button>
              ) : (
                <form action={joinCommunity}>
                  <input type="hidden" name="communityId" value={community.id} />
                  <Button type="submit">Join society</Button>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>
  );
}

function CommunityDetailFallback() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded-md bg-muted" />

        <div className="flex gap-2">
          <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

async function CommunityDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const communityId = id.trim();

  if (!communityId) {
    notFound();
  }

  return <CommunityDetailContent communityId={communityId} />;
}

export default function CommunityDetailPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-5">
        <Link href="/communities" className="text-sm text-primary hover:underline">
          ← Back to societies
        </Link>
      </div>

      <Suspense fallback={<CommunityDetailFallback />}>
        <CommunityDetailRoute params={params} />
      </Suspense>
    </main>
  );
}
