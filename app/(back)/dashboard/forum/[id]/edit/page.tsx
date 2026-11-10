import type { Metadata } from "next";
import { PostEdit } from "@/components/forum/post-edit";
import { S } from "@/lib/forum/strings";

export const metadata: Metadata = { title: S.editPostTitle };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="container py-9 sm:py-10">
      <PostEdit id={id} />
    </div>
  );
}
