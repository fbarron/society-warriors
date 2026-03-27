import { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card } from "./ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

interface SocietyPostFormProps {
  communityId: string;
  communityName: string;
  userRole?: "owner" | "admin" | "moderator" | "member";
  onPostCreated?: (post: any) => void;
}

export function SocietyPostForm({
  communityId,
  communityName,
  userRole = "member",
  onPostCreated,
}: SocietyPostFormProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = userRole === "owner" || userRole === "admin";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/society/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId,
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create post");
      }

      const data = await response.json();
      setContent("");

      if (onPostCreated) {
        onPostCreated(data.post);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 mb-6">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Post to {communityName}
          </label>
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="resize-none"
            rows={3}
            disabled={loading}
          />
        </div>

        {!isAdmin && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Your post will be reviewed by community admins before appearing
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={!content.trim() || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            isAdmin ? "Publish Post" : "Submit for Review"
          )}
        </Button>
      </form>
    </Card>
  );
}
