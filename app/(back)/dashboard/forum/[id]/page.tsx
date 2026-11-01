import type { Metadata } from "next";
import { PostView } from "@/components/forum/post-view";
import { S } from "@/lib/forum/strings";

export const metadata: Metadata = { title: S.title };

/** Page d'un post : la carte complète + ses commentaires (ajout, réponse, modification, suppression). */
export default async function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="container py-9 sm:py-10">
      <PostView id={id} />
    </div>
  );
}
