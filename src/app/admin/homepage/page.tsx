import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { HomepageEditor } from '@/components/admin/homepage-editor';

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
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <HomepageEditor />
    </div>
  );
}