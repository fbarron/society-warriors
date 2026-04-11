import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const trendingTopics = [
  "#FitnessJourney",
  "#GamingNight",
  "#BookClub",
  "#TravelTips",
  "#SocietyWarriors",
];

type HomePost = {
  id: string;
  content: string | null;
  created_at: string;
  user:
    | {
        id: string;
        name: string | null;
        avatar_url?: string | null;
      }
    | {
        id: string;
        name: string | null;
        avatar_url?: string | null;
      }[]
    | null;
  community:
    | {
        id: string;
        name: string | null;
      }
    | {
        id: string;
        name: string | null;
      }[]
    | null;
  comments?: Array<{ id: string }> | null;
};

type HomeCommunity = {
  id: string;
  name: string;
};

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "SW";
}

function formatPostTime(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getSingleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function Home() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: rawPosts },
    { data: rawCommunities },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("posts")
      .select(
        `
        id,
        content,
        created_at,
        user:users(id, name, avatar_url),
        community:communities(id, name),
        comments(id)
      `,
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase.from("communities").select("id, name").order("name", { ascending: true }).limit(4),
  ]);

  const posts = ((rawPosts ?? []) as HomePost[]).map((post) => ({
    ...post,
    user: getSingleRelation(post.user),
    community: getSingleRelation(post.community),
  }));

  const communities: HomeCommunity[] =
    (rawCommunities ?? []).map((community) => ({
      id: String(community.id),
      name: typeof community.name === "string" && community.name.trim() ? community.name : "Unnamed society",
    })) ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <section className="grid gap-6 rounded-xl border bg-card p-6 md:grid-cols-[1.3fr_1fr] md:p-8">
        <div className="space-y-4">
          <Badge variant="secondary" className="w-fit">
            {user ? "Welcome back" : "Social Media Platform"}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Connect with people who share your interests.</h1>
          <p className="max-w-xl text-muted-foreground">
            {user
              ? "You’re signed in. Jump back into your societies and catch up on the latest conversations."
              : "Post updates, join societies, and grow your network with real conversations."}
          </p>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <>
                <Button asChild>
                  <Link href="/protected">Open Feed</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/communities">Browse Societies</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild>
                  <Link href="/auth/signup">Create Account</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/auth/login">Log In</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="h-full min-h-[220px]">
          <CardHeader>
            <CardTitle>Trending Now</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {trendingTopics.map((topic) => (
              <Badge key={topic} variant="outline">
                {topic}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-2xl font-semibold">Latest Posts</h2>
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="grid gap-4 md:grid-cols-2">
            {posts.length > 0 ? (
              posts.map((post) => {
                const authorName = post.user?.name?.trim() || "Society member";
                const communityName = post.community?.name?.trim() || "General";
                const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;

                return (
                  <Card key={post.id} className="flex min-h-[220px] flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                            {getInitials(authorName)}
                          </div>
                          <div>
                            <CardTitle className="text-base">{authorName}</CardTitle>
                            <p className="text-sm text-muted-foreground">{formatPostTime(post.created_at)}</p>
                          </div>
                        </div>
                        <Badge variant="outline">{communityName}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between space-y-4">
                      <p className="whitespace-pre-wrap text-sm md:text-base">
                        {post.content?.trim() || "No content provided for this post yet."}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{commentCount} comments</span>
                        <Link href="/protected" className="font-medium text-foreground underline-offset-4 hover:underline">
                          View feed
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="md:col-span-2">
                <CardContent className="flex min-h-[220px] flex-col items-start justify-center gap-3 p-6">
                  <p className="text-base font-medium">No approved posts are live yet.</p>
                  <p className="text-sm text-muted-foreground">
                    Join a society and start the first conversation.
                  </p>
                  <Button asChild size="sm">
                    <Link href="/communities">Explore Societies</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="h-full min-h-[220px]">
            <CardHeader>
              <CardTitle>Societies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {communities.length > 0 ? (
                communities.map((community) => (
                  <div key={community.id} className="flex min-h-12 items-center justify-between rounded-md border px-3 py-2">
                    <span className="font-medium">{community.name}</span>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/communities/${community.id}`}>View</Link>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No societies have been created yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
