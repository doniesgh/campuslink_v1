import type { Metadata } from "next";
import { PostDetail } from "@/components/forum/post-detail";
import { getCurrentUser } from "@/lib/dal";
import { S } from "@/lib/forum/strings";

export const metadata: Metadata = { title: S.title };

export default async function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getCurrentUser(`/dashboard/forum/${encodeURIComponent(id)}`);
  return (
    <div className="container space-y-6 py-9 sm:py-10">
      <h1 className="text-2xl font-semibold">{S.title}</h1>
      <PostDetail id={id} viewer={user ? { id: user.id, role: user.role } : null} />
    </div>
  );
}
