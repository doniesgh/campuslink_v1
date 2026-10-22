import type { Metadata } from "next";
import { PostDetail } from "@/components/forum/post-detail";
import { S } from "@/lib/forum/strings";

export const metadata: Metadata = { title: S.title };

export default async function ForumModerationPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="container space-y-6 py-9 sm:py-10">
      <h1 className="text-2xl font-semibold">{S.title}</h1>
      <PostDetail id={id} />
    </div>
  );
}
