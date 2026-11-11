import { getCurrentUser } from "@/lib/dal";
import { AnnouncementsView } from "./announcements-view";

export default async function AnnouncementsPage() {
  const { user } = await getCurrentUser();
  // Backend injoignable : le layout du tableau de bord explique déjà le problème.
  if (!user) return null;
  return <AnnouncementsView userId={user.id} role={user.role} />;
}
