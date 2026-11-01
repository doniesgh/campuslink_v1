import { ClientMessages, DASHBOARD_NAMESPACES } from "@/components/i18n/client-messages";
import { ForumProvider } from "@/components/forum/forum-provider";

export default function ForumLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClientMessages namespaces={[...DASHBOARD_NAMESPACES, "forum"]}>
     <ForumProvider>{children}</ForumProvider>
    </ClientMessages>;
}
