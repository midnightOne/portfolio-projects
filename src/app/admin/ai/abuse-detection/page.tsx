import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { AbuseDetectionSettings } from '@/components/admin/abuse-detection-settings';

export default async function AbuseDetectionPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    redirect('/admin/login');
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Abuse Detection & Notifications"
        description="Configure content analysis, spam detection, and security notifications for the AI assistant"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin' },
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Abuse Detection', href: '/admin/ai/abuse-detection' }
        ]}
      >
        <AbuseDetectionSettings />
      </AdminPageLayout>
    </AdminLayout>
  );
}