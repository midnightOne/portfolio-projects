/**
 * Admin leads page (conversation-engine Req 15.2, task H3) — server wrapper
 * with the standard admin chrome (same pattern as /admin/ai/job-analysis);
 * the view lives in LeadsPanel.
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { LeadsPanel } from '@/components/admin/LeadsPanel';

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user as { role?: string })?.role !== 'admin') {
    redirect('/admin/login');
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Leads"
        description="Qualified conversation leads captured by the assistant (consent-gated) — slot snapshots, fit notes, notification state, and replay links"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin' },
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Leads', href: '/admin/ai/leads' },
        ]}
      >
        <LeadsPanel />
      </AdminPageLayout>
    </AdminLayout>
  );
}
