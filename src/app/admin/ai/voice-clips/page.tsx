/**
 * D50 voice-clip management page (ai-assistant 9b.2) — phrase categories with
 * randomized variants, rendered per configured provider voice.
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { VoiceClipsManager } from '@/components/admin/VoiceClipsManager';

export default async function VoiceClipsPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    redirect('/admin/login');
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Voice Clips"
        description="Pre-recorded clips (D50): latency fillers, connection-state audio, and greetings — rendered per provider voice"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Voice Clips', href: '/admin/ai/voice-clips' },
        ]}
      >
        <VoiceClipsManager />
      </AdminPageLayout>
    </AdminLayout>
  );
}
