import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { SafetyTripwirePanel } from '@/components/admin/SafetyTripwirePanel';

export default async function SafetyTripwirePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user as any)?.role !== 'admin') {
    redirect('/admin/login');
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Safety Tripwire"
        description="Word-flag tripwires over conversation transcripts, async LLM investigation, and your severity→action enforcement policy"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin' },
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Safety Tripwire', href: '/admin/ai/safety' },
        ]}
      >
        <SafetyTripwirePanel />
      </AdminPageLayout>
    </AdminLayout>
  );
}
