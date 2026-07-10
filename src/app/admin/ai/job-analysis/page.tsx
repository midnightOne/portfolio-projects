/**
 * Admin review page for persisted job analyses (ai-assistant task 8 / Req 8.1)
 * — server wrapper with the standard admin chrome (sidebar + breadcrumbs, same
 * pattern as /admin/ai/conversations); the view lives in JobAnalysisReview.
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { JobAnalysisReview } from '@/components/admin/JobAnalysisReview';

export default async function JobAnalysisReviewPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user as { role?: string })?.role !== 'admin') {
    redirect('/admin/login');
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Job Analyses"
        description="Reflink visitors' job-spec analyses via the reasoning model (D39) — persisted for review, with the owner work-preferences record they are judged against"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin' },
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Job Analyses', href: '/admin/ai/job-analysis' },
        ]}
      >
        <JobAnalysisReview />
      </AdminPageLayout>
    </AdminLayout>
  );
}
