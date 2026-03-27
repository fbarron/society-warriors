import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const trendingTopics = [
  "#FitnessJourney",
  "#GamingNight",
  "#BookClub",
  "#TravelTips",
  "#SocietyWarriors",
];

const feedPreview = [
  {
    name: "Ava Johnson",
    handle: "@avaj",
    post: "Just finished a 30-day challenge with my society. Proud of everyone for showing up every day!",
    likes: 128,
    comments: 34,
  },
  {
    name: "Noah Lee",
    handle: "@noahlee",
    post: "Who is joining tonight's live discussion? We are sharing study tips and goal trackers.",
    likes: 87,
    comments: 19,
  },
  {
    name: "Mia Carter",
    handle: "@miac",
    post: "Created a new creator circle for design feedback. Drop your portfolio links 👇",
    likes: 203,
    comments: 52,
  },
  {
    name: "Ethan Brooks",
    handle: "@ethanb",
    post: "Weekly challenge update: hit my reading goal and met two awesome people in the discussion thread.",
    likes: 156,
    comments: 27,
  },
];

const communities = ["Creators Hub", "Daily Motivation", "Study Crew", "Gamers Arena"];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <section className="grid gap-6 rounded-xl border bg-card p-6 md:grid-cols-[1.3fr_1fr] md:p-8">
        <div className="space-y-4">
          <Badge variant="secondary" className="w-fit">
            Social Media Platform
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Connect with people who share your interests.</h1>
          <p className="max-w-xl text-muted-foreground">
            Post updates, join societies, and grow your network with real conversations.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/auth/signup">Create Account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/login">Log In</Link>
            </Button>
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
        <h2 className="text-2xl font-semibold">Feed Preview</h2>
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="grid gap-4 md:grid-cols-2">
            {feedPreview.map((post) => (
              <Card key={post.handle} className="flex min-h-[220px] flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {post.name} <span className="ml-2 text-sm font-normal text-muted-foreground">{post.handle}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between space-y-4">
                  <p className="text-sm md:text-base">{post.post}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{post.likes} likes</span>
                    <span>{post.comments} comments</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="h-full min-h-[220px]">
            <CardHeader>
              <CardTitle>Societies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {communities.map((community) => (
                <div key={community} className="flex min-h-12 items-center justify-between rounded-md border px-3 py-2">
                  <span className="font-medium">{community}</span>
                  <Button size="sm" variant="secondary">
                    Join
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
