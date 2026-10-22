import type { Metadata } from "next";
import { PostForm } from "@/components/forum/post-form";
import { S } from "@/lib/forum/strings";

export const metadata: Metadata = { title: S.newPostTitle };

export default function NewPostPage() {
  return (
    <div className="container py-9 sm:py-10">
      <PostForm />
    </div>
  );
}
