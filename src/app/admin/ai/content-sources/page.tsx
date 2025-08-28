/**
 * Content Sources Admin Page
 * Admin interface for managing AI content sources
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { Metadata } from 'next';
import { ContentSourceManager } from '@/components/admin/content-source-manager';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';

export const metadata: Metadata = {
  title: 'Content Sources - AI Admin',
  description: 'Manage AI content sources and their configurations',
};

export default async function ContentSourcesPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Content Sources"
        description="Configure which content sources are available for AI context building"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin' },
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Content Sources', href: '/admin/ai/content-sources' }
        ]}
      >
        <ContentSourceManager />
      </AdminPageLayout>
    </AdminLayout>
  );
}