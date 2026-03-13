import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

const recentActivity = [
  "Ava posted in Society Warriors Fitness • 10m ago",
  "Noah invited you to Creator Circle • 1h ago",
  "Mia started a poll in Study Crew • 3h ago",
  "Ethan commented in Gaming Arena • 5h ago",
];

type CommunityRecord = {
  id: string;
  name: string;
  privacy: "public" | "private";
  description: string;
  category: string;
  members: number;
};

type MembershipRow = {
  community_id: string;
  user_id: string;
  status: string | null;
};

function toCommunityRecord(raw: Record<string, unknown>, members: number): CommunityRecord {
  return {
    id: String(raw.id ?? ""),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Unnamed community",
    privacy:
      typeof raw.privacy === "string" && raw.privacy.toLowerCase() === "private"
        ? "private"
        : "public",
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description
        : "No description yet.",
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category : "General",
    members,
  };
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
}

async function createCommunity(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { data: createdCommunity } = await supabase
    .from("communities")
    .insert({
    name,
    privacy: "public",
    description: "",
    category: "General",
    created_by: user.id,
    })
    .select("id")
    .single();

  if (createdCommunity?.id) {
    await supabase.from("community_memberships").upsert(
      {
        community_id: createdCommunity.id,
        user_id: user.id,
        role: "owner",
        status: "active",
      },
      { onConflict: "community_id,user_id" },
    );

    revalidatePath(`/communities/${createdCommunity.id}`);
  }

  revalidatePath("/communities");
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
}

export default async function CommunitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawCommunities } = await supabase.from("communities").select("*");
  const communityRows = (rawCommunities ?? []) as Record<string, unknown>[];
  const communityIds = communityRows
    .map((community) => String(community.id ?? ""))
    .filter((value) => value.length > 0);

  let membershipRows: MembershipRow[] = [];
  if (communityIds.length > 0) {
    const { data: memberships } = await supabase
      .from("community_memberships")
      .select("community_id, user_id, status")
      .in("community_id", communityIds)
      .eq("status", "active");

    membershipRows = (memberships ?? []) as MembershipRow[];
  }

  const memberCountByCommunity = membershipRows.reduce<Record<string, number>>((counts, row) => {
    counts[row.community_id] = (counts[row.community_id] ?? 0) + 1;
    return counts;
  }, {});

  const joinedCommunityIds = new Set(
    user
      ? membershipRows
          .filter((row) => row.user_id === user.id)
          .map((row) => row.community_id)
      : [],
  );

  const allCommunities = communityRows.map((community) =>
    toCommunityRecord(community, memberCountByCommunity[String(community.id ?? "")] ?? 0),
  );

  const yourCommunities = allCommunities.filter((community) => joinedCommunityIds.has(community.id));
  const discoverCommunities = allCommunities.filter((community) => !joinedCommunityIds.has(community.id));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <section className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Communities</h1>
          <p className="text-muted-foreground">Find, join, and manage your groups in one place.</p>
        </div>
        <form action={createCommunity} className="flex w-full max-w-md gap-2">
          <Input name="name" placeholder="Community name" required />
          <Button type="submit">Create</Button>
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Communities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {yourCommunities.length === 0 && (
                <p className="text-sm text-muted-foreground">You haven&apos;t joined any communities yet.</p>
              )}
              {yourCommunities.map((community) => (
                <div key={community.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{community.name}</h2>
                    <Badge variant="outline">{community.privacy === "private" ? "Private" : "Public"}</Badge>
                  </div>
                  <p className="mb-2 text-sm text-muted-foreground">{community.members} members</p>
                  <p className="mb-4 text-sm">{community.description}</p>
                  <div className="flex gap-2">
                    <Button size="sm" asChild>
                      <Link href={`/communities/${community.id}`}>View</Link>
                    </Button>
                    <form action={leaveCommunity}>
                      <input type="hidden" name="communityId" value={community.id} />
                      <Button size="sm" variant="outline" type="submit">
                        Leave
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Discover Communities</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {discoverCommunities.length === 0 && (
                <p className="text-sm text-muted-foreground">No communities left to discover right now.</p>
              )}
              {discoverCommunities.map((community) => (
                <div key={community.id} className="rounded-lg border p-4">
                  <div className="mb-1 text-base font-semibold">{community.name}</div>
                  <div className="mb-3 text-sm text-muted-foreground">
                    {community.category} • {community.members} members
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/communities/${community.id}`}>View</Link>
                    </Button>
                    {community.privacy === "private" ? (
                      <Button size="sm" variant="secondary" disabled>
                        Private
                      </Button>
                    ) : (
                      <form action={joinCommunity}>
                        <input type="hidden" name="communityId" value={community.id} />
                        <Button size="sm" variant="secondary" type="submit">
                          Join
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recentActivity.map((activity) => (
                <li key={activity} className="rounded-md border p-3 text-sm">
                  {activity}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
