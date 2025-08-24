import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { HomepageEditor } from '@/components/admin/homepage-editor';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';

export const metadata: Metadata = {
  title: 'Homepage Configuration - Admin',
  description: 'Configure homepage sections and layout',
};

export default async function HomepageConfigPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/admin/login');
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Homepage Sections"
        description="Configure homepage sections, layout, and content"
      >
        <HomepageEditor />
      </AdminPageLayout>
    </AdminLayout>
  );
}