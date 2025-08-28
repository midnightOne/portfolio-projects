/**
 * Admin Conversations Management Page
 * 
 * Comprehensive conversation management interface for administrators.
 * Includes search, filtering, replay, export, and analytics capabilities.
 */

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { ConversationsManagement } from '@/components/admin/conversations-management';

export default async function AdminConversationsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    redirect('/admin/login');
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Conversation Management"
        description="View, search, and manage AI conversation history with comprehensive analytics and debugging tools."
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin' },
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Conversations', href: '/admin/ai/conversations' }
        ]}
      >
        <Suspense fallback={<div>Loading conversations...</div>}>
          <ConversationsManagement />
        </Suspense>
      </AdminPageLayout>
    </AdminLayout>
  );
}