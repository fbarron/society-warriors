import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Bell, BellOff, Trash2 } from "lucide-react";
import { SocietyMemberList, type SocietyMember } from "@/components/society-member-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deletePost as deletePostRecord } from "@/lib/supabase/queries";
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
  avatar_url: string | null;
};

type CommunityPost = {
  id: string;
  content: string;
  created_at: string;
  image_metadata?: Array<{
    url: string;
    path: string;
    mime_type: string;
    size_bytes: number;
    filename: string;
  }> | null;
  user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
};

const DEFAULT_AVATAR_URL = "/default-avatar.svg";

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

async function updatePostNotifications(formData: FormData) {
  "use server";

  const communityId = String(formData.get("communityId") ?? "").trim();
  const enabledRaw = String(formData.get("enabled") ?? "true").trim().toLowerCase();
  const enabled = enabledRaw === "true";

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

  const { isCreator, myRole } = await getActorPermissions(communityId, user.id);
  const isAdminRole = isCreator || myRole === "owner" || myRole === "admin";

  if (isAdminRole) {
    return;
  }

  const { data: activeMembership } = await supabase
    .from("community_memberships")
    .select("user_id")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!activeMembership) {
    return;
  }

  await supabase.from("community_notification_preferences").upsert(
    {
      community_id: communityId,
      user_id: user.id,
      enabled,
    },
    { onConflict: "community_id,user_id" },
  );

  revalidatePath("/communities");
  revalidatePath(`/communities/${communityId}`);
}

async function deleteCommunityPost(formData: FormData) {
  "use server";

  const communityId = String(formData.get("communityId") ?? "").trim();
  const postId = String(formData.get("postId") ?? "").trim();

  if (!communityId || !postId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { data: post } = await supabase
    .from("posts")
    .select("id, user_id, community_id")
    .eq("id", postId)
    .single();

  if (!post || post.community_id !== communityId) {
    return;
  }

  const { isCreator, myRole } = await getActorPermissions(communityId, user.id);
  const canDeletePost =
    post.user_id === user.id ||
    isCreator ||
    myRole === "owner" ||
    myRole === "admin" ||
    myRole === "moderator";

  if (!canDeletePost) {
    return;
  }

  await deletePostRecord(postId);

  revalidatePath("/communities");
  revalidatePath(`/communities/${communityId}`);
  revalidatePath("/protected");
  revalidatePath("/profile");
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
      ? await supabase.from("users").select("id, name, avatar_url").in("id", activeMemberIds)
      : { data: [] as UserRow[] };

  const usersById = new Map((usersData ?? []).map((profile) => [profile.id, profile]));
  const managedMembers: SocietyMember[] = activeMemberships.map((member) => {
    const profile = usersById.get(member.user_id);
    const role: SocietyMember["role"] =
      member.role === "owner" || member.role === "admin" || member.role === "moderator"
        ? member.role
        : "member";

    return {
      id: member.user_id,
      user: {
        id: member.user_id,
        name: profile?.name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
      role,
      status: member.status === "pending" ? "pending" : "active",
    };
  });

  const memberCount = activeMemberships.length;
  const myMembership = user ? activeMemberships.find((row) => row.user_id === user.id) : null;
  const isMember = Boolean(myMembership);
  const myRole = myMembership?.role ?? null;
  const isCreator = Boolean(user && community.createdBy === user.id);
  const canEditCommunity =
    isCreator || myRole === "owner" || myRole === "admin" || myRole === "moderator";
  const canManageMembers = isCreator || myRole === "owner" || myRole === "admin";
  const isAdminRole = isCreator || myRole === "owner" || myRole === "admin";
  const canViewFeed = community.privacy === "public" || isMember || canEditCommunity;
  const { count: pendingPostsCount } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("community_id", community.id)
    .eq("status", "pending");

  const { data: postsData } = canViewFeed
    ? await supabase
        .from("posts")
        .select(
          "id, content, created_at, image_metadata, user:users(id, name, avatar_url)",
        )
        .eq("community_id", community.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as CommunityPost[] };

  const communityPosts = (postsData ?? []) as unknown as CommunityPost[];

  let postNotificationsEnabled = true;
  if (user && isMember && !isAdminRole) {
    const { data: preference } = await supabase
      .from("community_notification_preferences")
      .select("enabled")
      .eq("community_id", community.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (typeof preference?.enabled === "boolean") {
      postNotificationsEnabled = preference.enabled;
    }
  }

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

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Society feed</CardTitle>
            </CardHeader>
            <CardContent>
              {!canViewFeed ? (
                <p className="text-sm text-muted-foreground">
                  This society is private. Join to view posts.
                </p>
              ) : communityPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No posts yet in this society.</p>
              ) : (
                <div className="max-h-[38rem] space-y-4 overflow-y-auto pr-4">
                  {communityPosts.map((post) => {
                    const authorName = post.user?.name || `User ${post.user?.id?.slice(0, 8) || "unknown"}`;
                    const authorAvatarUrl = post.user?.avatar_url || null;
                    const canDeletePost = Boolean(
                      user && (post.user?.id === user.id || canEditCommunity),
                    );

                    return (
                      <article key={post.id} className="rounded-md border bg-background p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                              {authorAvatarUrl ? (
                                <Image
                                  src={authorAvatarUrl}
                                  alt={authorName}
                                  width={36}
                                  height={36}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                                  {authorName.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{authorName}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(post.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {canDeletePost && (
                            <form action={deleteCommunityPost}>
                              <input type="hidden" name="communityId" value={community.id} />
                              <input type="hidden" name="postId" value={post.id} />
                              <Button
                                type="submit"
                                size="icon"
                                variant="outline"
                                className="text-red-600"
                                aria-label="Delete post"
                                title="Delete post"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </form>
                          )}
                        </div>

                        <p className="whitespace-pre-wrap text-sm">{post.content}</p>

                        {post.image_metadata && post.image_metadata.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {post.image_metadata.map((image) => (
                              <a
                                key={image.path}
                                href={image.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border bg-muted/30 p-1"
                              >
                                <Image
                                  src={image.url}
                                  alt={image.filename || "Post image"}
                                  width={260}
                                  height={180}
                                  className="h-auto max-h-48 w-full object-contain"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {(canManageMembers || canEditCommunity) && (
            <details className="rounded-lg border border-dashed">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                Admin controls (click to expand/collapse)
              </summary>

              <div className="space-y-4 px-4 pb-4">
                {canManageMembers && (
                  <Card className="border-dashed">
                    <CardHeader>
                      <CardTitle className="text-base">Admin actions</CardTitle>
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
                  <SocietyMemberList
                    members={managedMembers}
                    currentUserId={user?.id}
                    currentUserRole={
                      myRole === "owner" ||
                      myRole === "admin" ||
                      myRole === "moderator" ||
                      myRole === "member"
                        ? myRole
                        : undefined
                    }
                    communityId={community.id}
                  />
                )}
              </div>
            </details>
          )}

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Post notifications</CardTitle>
            </CardHeader>
            <CardContent>
              {!user ? (
                <p className="text-sm text-muted-foreground">Log in to manage post notifications.</p>
              ) : !isMember ? (
                <p className="text-sm text-muted-foreground">Join this society to manage post notifications.</p>
              ) : isAdminRole ? (
                <p className="text-sm text-muted-foreground">
                  As an admin, post notifications are always enabled for this society.
                </p>
              ) : (
                <form action={updatePostNotifications} className="flex items-center justify-between gap-4">
                  <input type="hidden" name="communityId" value={community.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={postNotificationsEnabled ? "false" : "true"}
                  />

                  <div className="flex items-center gap-2">
                    {postNotificationsEnabled ? (
                      <Bell className="h-4 w-4 text-amber-500" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      Post notifications {postNotificationsEnabled ? "on" : "off"}
                    </span>
                  </div>

                  <button
                    type="submit"
                    role="switch"
                    aria-checked={postNotificationsEnabled}
                    aria-label={postNotificationsEnabled ? "Disable post notifications" : "Enable post notifications"}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors ${
                      postNotificationsEnabled
                        ? "border-primary bg-primary/90"
                        : "border-muted-foreground/30 bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        postNotificationsEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </form>
              )}
            </CardContent>
          </Card>

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
