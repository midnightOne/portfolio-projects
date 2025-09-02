/**
 * Admin Conversation Management Page
 * 
 * Provides comprehensive conversation management interface for administrators
 * using the simplified conversation management system.
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import ConversationManagement from '@/components/admin/conversation-management';

export default async function ConversationManagementPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Conversation Management"
        description="Manage AI conversations, view analytics, and debug conversation issues"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "AI Assistant", href: "/admin/ai" },
          { label: "Conversations", href: "/admin/ai/conversations" }
        ]}
      >
        <ConversationManagement />
      </AdminPageLayout>
    </AdminLayout>
  );
}