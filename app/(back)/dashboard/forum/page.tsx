import type { Metadata } from "next";
import { AddPostButton } from "@/components/forum/add-post-button";
import { Feed } from "@/components/forum/feed";
import { CommentIcon, IconCircle } from "@/components/forum/icons";
import { getCurrentUser } from "@/lib/dal";
import { S } from "@/lib/forum/strings";

export const metadata: Metadata = { title: S.title };

export default async function PostsPage() {
  const { user } = await getCurrentUser("/dashboard/forum");
  return (
    <div className="container pb-28 pt-9 sm:pt-10">
      <header className="mx-auto flex max-w-xl flex-col items-center text-center">
        <IconCircle tone="brand" size="lg" className="size-14 ring-4 ring-primary/15 [&>svg]:size-7">
          <CommentIcon />
        </IconCircle>
        <h1 className="mt-3 text-2xl font-semibold">{S.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{S.subtitle}</p>
      </header>
      <Feed viewer={user ? { id: user.id, role: user.role } : null} />
      <AddPostButton />
    </div>
  );
}
