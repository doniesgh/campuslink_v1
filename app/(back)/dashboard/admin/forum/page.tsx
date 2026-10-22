import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InlineFeedback } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { toApiError } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { getErrorFormatter } from "@/lib/i18n/server";
import { serverApi } from "@/lib/server-api";
import { moderationHref, reportsPath } from "@/lib/forum/paths";
import type { ReportList, ReportStatus } from "@/lib/forum/types";




export default async function ForumModerationPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
 
  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold">{S.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{S.subtitle}</p>
      </header>
      <PostsTable />
    </div>
  );
}
